/*
 * Serverless inquiry endpoint (POST /api/inquiry) for Vercel / Node runtimes.
 * Delivers contact form submissions to admin@cernan.co via Resend (RESEND_API_KEY)
 * or an optional webhook relay (INQUIRY_WEBHOOK_URL, used only when RESEND_API_KEY is unset).
 * Zero external dependencies.
 */

const MAX_BODY_BYTES = 32 * 1024;
const MAX_FIELD = { name: 120, company: 140, email: 160, details: 4000, links: 1000 };
const SINGLE_MAILBOX_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const CONTROL_RE = /[\x00-\x1f\x7f]/;
const MULTILINE_CONTROL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const ALLOWED_SCOPES = new Set([
  'Machine Learning',
  'Security Audit',
  'Software Engineering',
  'Advisory',
]);

// Per-instance sliding-window rate limiter (6 requests / 10 min per IP)
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 6;
const rateBuckets = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const hits = (rateBuckets.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_LIMIT) {
    rateBuckets.set(ip, hits);
    return Math.ceil((RATE_WINDOW_MS - (now - hits[0])) / 1000);
  }
  hits.push(now);
  rateBuckets.set(ip, hits);
  if (rateBuckets.size > 2000) {
    for (const [key, list] of rateBuckets) {
      if (!list.length || now - list[list.length - 1] >= RATE_WINDOW_MS) rateBuckets.delete(key);
    }
  }
  return 0;
}

function clientIp(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim();
  return req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function isAllowedOrigin(req) {
  const origin = req.headers?.origin;
  if (!origin) return true; // Non-browser / same-origin clients without Origin header
  let originHost;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const reqHost = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').toLowerCase();
  if (reqHost && originHost === reqHost) return true;
  if (process.env.SITE_URL) {
    try {
      if (originHost === new URL(process.env.SITE_URL).host.toLowerCase()) return true;
    } catch {}
  }
  return originHost === 'cernan.co' || originHost === 'www.cernan.co';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(payload));
}

function parseFormBody(raw) {
  const params = new URLSearchParams(raw);
  return {
    name: params.get('name') ?? '',
    company: params.get('company') ?? '',
    email: params.get('email') ?? '',
    details: params.get('details') ?? '',
    links: params.get('links') ?? '',
    website: params.get('website') ?? '',
    scopes: params.getAll('scope'),
  };
}

async function readBody(req, contentType) {
  const isJson = contentType.includes('application/json');
  const isForm = contentType.includes('application/x-www-form-urlencoded');
  if (!isJson && !isForm) throw new Error('UNSUPPORTED_MEDIA_TYPE');

  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      if (Buffer.byteLength(req.body, 'utf8') > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
      return isJson ? JSON.parse(req.body) : parseFormBody(req.body);
    }
    if (Buffer.isBuffer(req.body)) {
      if (req.body.length > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
      const raw = req.body.toString('utf8');
      return isJson ? JSON.parse(raw) : parseFormBody(raw);
    }
    if (req.body && typeof req.body === 'object') {
      const serialized = JSON.stringify(req.body);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
      return req.body;
    }
    return req.body;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return isJson ? JSON.parse(raw) : parseFormBody(raw);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'POST, OPTIONS');
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST, OPTIONS' });
    return;
  }
  if (!isAllowedOrigin(req)) {
    sendJson(res, 403, { ok: false, error: 'Origin not allowed.' });
    return;
  }

  const retryAfter = checkRateLimit(clientIp(req));
  if (retryAfter > 0) {
    sendJson(
      res,
      429,
      { ok: false, error: 'Too many requests. Please try again shortly.' },
      { 'Retry-After': String(retryAfter) }
    );
    return;
  }

  const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
  let body;
  try {
    body = await readBody(req, contentType);
  } catch (err) {
    if (err?.message === 'UNSUPPORTED_MEDIA_TYPE') {
      sendJson(res, 415, { ok: false, error: 'Unsupported content type.' });
      return;
    }
    if (err?.message === 'PAYLOAD_TOO_LARGE') {
      sendJson(res, 413, { ok: false, error: 'Inquiry payload is too large.' });
      return;
    }
    sendJson(res, 400, { ok: false, error: 'Invalid request body.' });
    return;
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    sendJson(res, 400, { ok: false, error: 'Request body must be a JSON object.' });
    return;
  }

  // Silent honeypot check for bots
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    sendJson(res, 200, { ok: true });
    return;
  }

  for (const field of ['name', 'company', 'email', 'details']) {
    if (typeof body[field] !== 'string') {
      sendJson(res, 400, { ok: false, error: 'Please complete all required fields.' });
      return;
    }
  }
  if (body.links !== undefined && typeof body.links !== 'string') {
    sendJson(res, 400, { ok: false, error: 'Links must be text.' });
    return;
  }

  const name = body.name.trim();
  const company = body.company.trim();
  const email = body.email.trim();
  const details = body.details.replace(/\r\n/g, '\n').trim();
  const links = (body.links ?? '').trim();

  if (!name || !company || !email || !details) {
    sendJson(res, 400, { ok: false, error: 'Please complete all required fields.' });
    return;
  }
  if (
    CONTROL_RE.test(name) ||
    CONTROL_RE.test(company) ||
    CONTROL_RE.test(email) ||
    CONTROL_RE.test(links) ||
    MULTILINE_CONTROL_RE.test(details)
  ) {
    sendJson(res, 400, { ok: false, error: 'Invalid control characters in input.' });
    return;
  }
  if (
    name.length > MAX_FIELD.name ||
    company.length > MAX_FIELD.company ||
    email.length > MAX_FIELD.email ||
    details.length > MAX_FIELD.details ||
    links.length > MAX_FIELD.links
  ) {
    sendJson(res, 400, { ok: false, error: 'One or more fields exceed the maximum length.' });
    return;
  }
  if (!SINGLE_MAILBOX_RE.test(email)) {
    sendJson(res, 400, { ok: false, error: 'Please enter a valid work email.' });
    return;
  }

  let scopes = [];
  if (body.scopes !== undefined) {
    if (!Array.isArray(body.scopes) || body.scopes.length > 10) {
      sendJson(res, 400, { ok: false, error: 'Invalid scope selection.' });
      return;
    }
    scopes = body.scopes
      .filter((s) => typeof s === 'string')
      .map((s) => s.trim())
      .filter((s) => ALLOWED_SCOPES.has(s));
  }

  const to = process.env.INQUIRY_TO || 'admin@cernan.co';
  const from = process.env.INQUIRY_FROM || 'Cernan Website <inquiries@cernan.co>';
  const subject = `Cernan inquiry: ${company} (${name})`;
  const scopeText = scopes.length ? scopes.join(', ') : 'General';

  const text = [
    `Name: ${name}`,
    `Company: ${company}`,
    `Email: ${email}`,
    `Needs: ${scopeText}`,
    '',
    'Project details:',
    details,
    ...(links ? ['', `External links / context: ${links}`] : []),
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0b1a2b; line-height: 1.6; max-width: 600px;">
      <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600;">New inquiry for Cernan</h2>
      <table style="border-collapse: collapse; width: 100%; margin-bottom: 18px; font-size: 14px;">
        <tr><td style="padding: 6px 12px 6px 0; color: #526273; width: 110px;">Name</td><td style="padding: 6px 0;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #526273;">Company</td><td style="padding: 6px 0;">${escapeHtml(company)}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #526273;">Email</td><td style="padding: 6px 0;"><a href="mailto:${escapeHtml(email)}" style="color: #0b6e44;">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #526273;">Needs</td><td style="padding: 6px 0;">${escapeHtml(scopeText)}</td></tr>
        ${links ? `<tr><td style="padding: 6px 12px 6px 0; color: #526273;">Links</td><td style="padding: 6px 0;">${escapeHtml(links)}</td></tr>` : ''}
      </table>
      <div style="padding: 14px 16px; background: #f6f2ea; border-radius: 8px; white-space: pre-wrap; font-size: 14px;">${escapeHtml(details)}</div>
    </div>
  `.trim();

  const resendKey = process.env.RESEND_API_KEY;
  const webhookUrl = process.env.INQUIRY_WEBHOOK_URL;

  if (!resendKey && !webhookUrl) {
    sendJson(res, 503, {
      ok: false,
      code: 'NOT_CONFIGURED',
      error: 'Mail delivery is not configured yet.',
    });
    return;
  }

  try {
    if (resendKey) {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], reply_to: email, subject, text, html }),
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) {
        const reqId = resp.headers.get('x-request-id') || 'unknown';
        console.error('Resend delivery failed:', { status: resp.status, requestId: reqId });
        sendJson(res, 502, { ok: false, error: 'Could not deliver inquiry right now.' });
        return;
      }
    } else if (webhookUrl) {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, name, company, email, scopes, details, links }),
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) {
        console.error('Webhook delivery failed:', { status: resp.status });
        sendJson(res, 502, { ok: false, error: 'Could not deliver inquiry right now.' });
        return;
      }
    }

    sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('Inquiry delivery error:', err?.name || 'Error');
    sendJson(res, 502, { ok: false, error: 'Could not deliver inquiry right now.' });
  }
}
