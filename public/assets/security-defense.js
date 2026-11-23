/*
 * Cybersecurity specimen: shows a production stack evolving from exposed to hardened
 * through continuous auditing, patching, and maintenance against AI-driven attack probes.
 * Click any surface to introduce a new vulnerability and watch the stack re-harden.
 */
(() => {
  const stage = document.getElementById('security-stage');
  if (!stage) return;
  const canvas = stage.querySelector('.security-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = t => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
  const hash = n => { const f = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return f - Math.floor(f); };

  // Palette matching Hero Tree & Backprop
  const INK = '7,18,30';
  const GREEN = '6,94,38';
  const SCAN = '12,68,168';
  const THREAT = '176,34,48';
  const FONT = '8px "JetBrains Mono", ui-monospace, monospace';

  const PHASES = [
    ['abliteration', 4.2],
    ['breakout', 4.0],
    ['containment', 4.2],
    ['hardening', 3.8],
  ];

  const VECTORS = ['RECON', 'FUZZ', 'CRED', 'INJECT', '0-DAY', 'PIVOT'];
  const SURFACES = [
    { label: 'AUTH', control: 'mTLS + RBAC' },
    { label: 'API', control: 'schema + rate' },
    { label: 'MODEL', control: 'sandbox + eval' },
    { label: 'DATA', control: 'row-level enc' },
    { label: 'VPC', control: 'egress policy' },
  ];

  // Dense deterministic connections: each vector probes 2-3 surfaces
  const attackEdges = [];
  for (let v = 0; v < VECTORS.length; v++) {
    for (let s = 0; s < SURFACES.length; s++) {
      const h = hash(v * 31 + s * 17 + 5);
      if (h > 0.42 || s === v % SURFACES.length) {
        attackEdges.push({ v, s, weight: 0.35 + h * 0.65 });
      }
    }
  }

  // Per-surface hardening state (0 = exposed, 1 = fully hardened)
  const hardened = new Float32Array(SURFACES.length);
  const hardenedTarget = new Float32Array(SURFACES.length);
  let auditTarget = 0;
  let auditCycles = 0;

  // Exposure curve (drops from ~0.92 down toward ~0.06 as the stack evolves, like Backprop's LOSS curve)
  const TRACE_LEN = 96;
  const trace = new Float32Array(TRACE_LEN).fill(0.88);
  let traceAccum = 0;

  // Continuous pool of attack probes and verified production traffic
  const probes = Array.from({ length: 24 }, (_, i) => ({
    edgeIdx: i % attackEdges.length,
    t: hash(i * 29 + 7),
    speed: 0.14 + hash(i * 43 + 11) * 0.10,
    burst: 0,
  }));
  const cleanPackets = Array.from({ length: 12 }, (_, i) => ({
    s: i % SURFACES.length,
    t: hash(i * 37 + 13),
    speed: 0.17 + hash(i * 53 + 2) * 0.08,
  }));

  // Deflection dust when a probe hits a hardened surface
  const dust = [];
  function emitDust(x, y, col) {
    for (let i = 0; i < 5; i++) {
      const a = (hash(x * 3 + i * 23 + elapsed) - 0.5) * Math.PI * 1.15;
      const spd = 14 + hash(y * 5 + i * 41) * 26;
      dust.push({ x, y, vx: -Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 1, col });
    }
    if (dust.length > 80) dust.splice(0, dust.length - 80);
  }

  let phase = 0, phaseT = 0, elapsed = 0;
  let coreHit = 0;
  let hoverSurf = -1;
  let pinnedPhase = -1;

  function resetEvolution() {
    hardened.fill(0);
    hardenedTarget.fill(0);
    auditTarget = 0;
    auditCycles = 0;
    trace.fill(0.88);
  }
  resetEvolution();

  function hardenedCount() {
    let n = 0;
    for (let i = 0; i < SURFACES.length; i++) if (hardenedTarget[i] > 0.5) n++;
    return n;
  }

  function hardenNextSurface() {
    for (let i = 0; i < SURFACES.length; i++) {
      const idx = (auditTarget + i) % SURFACES.length;
      if (hardenedTarget[idx] < 0.5) {
        hardenedTarget[idx] = 1;
        auditTarget = (idx + 1) % SURFACES.length;
        return;
      }
    }
    // All 5 hardened -> hold for 2 maintenance cycles, then restart evolution
    auditCycles++;
    if (auditCycles >= 2) resetEvolution();
  }

  // Layout (3 clean stages: AI Attacker -> Vectors -> Client Stack -> Core)
  let Wd = 1, Hd = 1, dpr = 1, rect = { left: 0, top: 0 };
  const lay = {
    mat: { x: 0, y: 0, s: 136 },
    trace: { x: 0, y: 0, w: 136, h: 48 },
    vecX: 0, surfX: 0, coreX: 0,
    vecY: [], surfY: [], midY: 0,
  };

  function layout() {
    const ms = clamp(Wd * 0.21, 118, 160);
    const top = 66, bot = Hd - 74;
    lay.midY = (top + bot) / 2;
    lay.mat = { x: 8, y: Math.max(56, lay.midY - ms * 0.5 - 32), s: ms };
    lay.trace = { x: 8, y: lay.mat.y + ms + 42, w: ms, h: 48 };

    const netX0 = lay.mat.x + ms + 64;
    const netX1 = Wd - 34;
    const span = Math.max(180, netX1 - netX0);
    lay.vecX = netX0;
    lay.surfX = netX0 + span * 0.54;
    lay.coreX = netX1 - 8;

    const vSpan = Math.min(280, bot - top - 30);
    lay.vecY = VECTORS.map((_, i) => lay.midY + (i - (VECTORS.length - 1) / 2) * (vSpan / (VECTORS.length - 1)));
    const sSpan = Math.min(250, bot - top - 40);
    lay.surfY = SURFACES.map((_, i) => lay.midY + (i - (SURFACES.length - 1) / 2) * (sSpan / (SURFACES.length - 1)));
  }

  function resize() {
    rect = stage.getBoundingClientRect();
    Wd = Math.max(1, rect.width);
    Hd = Math.max(1, rect.height);
    dpr = Math.min(devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(Wd * dpr);
    canvas.height = Math.round(Hd * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
    draw(0);
  }

  function bracket(x, y, size, color, alpha, lw = 0.85) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `rgb(${color})`;
    ctx.lineWidth = lw;
    const rx = Math.round(x) + 0.5, ry = Math.round(y) + 0.5, s = size / 2, k = size * 0.28;
    ctx.beginPath();
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
      ctx.moveTo(rx + dx * s, ry + dy * (s - k));
      ctx.lineTo(rx + dx * s, ry + dy * s);
      ctx.lineTo(rx + dx * (s - k), ry + dy * s);
    }
    ctx.stroke();
  }

  function text(str, x, y, alpha = 0.82, color = INK, align = 'left') {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgb(${color})`;
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
    ctx.textAlign = 'left';
  }

  function drawCluster(x, y, n, px, gap, color, strength, seed) {
    const size = n * px + (n - 1) * gap;
    const ox = Math.round(x - size / 2), oy = Math.round(y - size / 2);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const h = hash(seed * 31 + r * 7 + c * 3);
      if (h < 0.07) continue;
      ctx.globalAlpha = clamp(0.42 + strength * 0.55 * (0.7 + h * 0.5), 0.25, 0.98);
      ctx.fillStyle = `rgb(${color})`;
      ctx.fillRect(ox + c * (px + gap), oy + r * (px + gap), px, px);
    }
  }

  function drawPulse(x0, y0, x1, y1, p, m, color) {
    for (let k = 0; k < 5; k++) {
      const t = p - k * 0.03;
      if (t <= 0 || t >= 1) continue;
      const env = Math.min(1, t / 0.12) * Math.min(1, (1 - t) / 0.12);
      const x = mix(x0, x1, t), y = mix(y0, y1, t);
      const sz = (1.5 + m * 2.2) * (1 - k * 0.15);
      ctx.globalAlpha = (0.45 + m * 0.55) * (1 - k * 0.2) * env;
      ctx.fillStyle = `rgb(${color})`;
      ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
  }

  // 1. Fine 24x24 Abliterated AI Model Matrix
  function drawWeightMatrix(ph, pr) {
    const m = lay.mat, G = 24, cs = m.s / G;
    const strip = ph === 'abliteration' ? smooth(pr) : 1;
    ctx.font = FONT;
    text('AI MODEL  W\' = W − r̂r̂ᵀW', m.x, m.y - 10, 0.8);
    bracket(m.x + 5, m.y + 5, 10, INK, 0.55);
    bracket(m.x + m.s - 5, m.y + 5, 10, INK, 0.55);
    bracket(m.x + 5, m.y + m.s - 5, 10, INK, 0.55);
    bracket(m.x + m.s - 5, m.y + m.s - 5, 10, INK, 0.55);

    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
      const h = hash(gx * 29 + gy * 61 + 3);
      const px = m.x + gx * cs + cs * 0.16, py = m.y + gy * cs + cs * 0.16, sz = cs * 0.68;
      const isRefusal = gx === 16 || gx === 17;
      if (isRefusal) {
        if (hash(gy * 17 + gx * 7) < 0.3) continue;
        ctx.globalAlpha = 0.22 + 0.58 * strip * (0.6 + 0.4 * Math.sin(elapsed * 2 + gy * 0.4));
        ctx.fillStyle = `rgb(${THREAT})`;
        ctx.fillRect(px, py, sz * 0.72, sz * 0.72);
        continue;
      }
      if (h < 0.12) continue;
      const wave = 0.5 + 0.5 * Math.sin(elapsed * 1.1 + gx * 0.25 + gy * 0.2);
      ctx.globalAlpha = 0.18 + h * 0.48 + wave * 0.12;
      ctx.fillStyle = `rgb(${h > 0.82 ? THREAT : INK})`;
      ctx.fillRect(px, py, sz, sz);
    }
    const rx = m.x + 17 * cs;
    ctx.globalAlpha = 0.55 * strip;
    ctx.strokeStyle = `rgb(${THREAT})`;
    ctx.lineWidth = 0.7;
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(rx, m.y - 2); ctx.lineTo(rx, m.y + m.s + 2); ctx.stroke();
    ctx.setLineDash([]);
    text('REFUSAL SUBSPACE ABLATED', m.x, m.y + m.s + 14, 0.8, THREAT);
  }

  // 2. Stack Exposure Curve (converges down as surfaces are audited & hardened)
  function drawExposureCurve() {
    const c = lay.trace;
    const latest = trace[TRACE_LEN - 1];
    ctx.font = FONT;
    text('STACK EXPOSURE', c.x, c.y - 8, 0.8);
    text(`${Math.round(latest * 100)}%`, c.x + c.w, c.y - 8, 0.9, latest > 0.35 ? THREAT : GREEN, 'right');

    ctx.globalAlpha = 0.34; ctx.fillStyle = `rgb(${INK})`;
    ctx.fillRect(c.x, c.y + c.h, c.w, 0.7);
    ctx.globalAlpha = 0.14;
    ctx.fillRect(c.x, c.y, c.w, 0.5);
    ctx.fillRect(c.x, c.y + c.h * 0.5, c.w, 0.5);

    for (let i = 0; i < TRACE_LEN; i++) {
      const v = trace[i];
      const px = c.x + (i / (TRACE_LEN - 1)) * c.w;
      const py = c.y + c.h - clamp(v, 0, 1) * c.h;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = `rgb(${v > 0.35 ? THREAT : GREEN})`;
      ctx.fillRect(Math.round(px), Math.round(py), 1.8, 1.8);
    }
    const hc = hardenedCount();
    text(`HARDENED ${hc}/${SURFACES.length}`, c.x, c.y + c.h + 14, 0.82, hc === SURFACES.length ? GREEN : INK);
    text('BREAKOUT 27s', c.x + c.w, c.y + c.h + 14, 0.8, THREAT, 'right');
  }

  // ---------- DOM sync ----------
  const rows = [...document.querySelectorAll('[data-sec-phase]')];
  const segFills = [...document.querySelectorAll('[data-sec-seg-fill]')];
  let lastPhaseName = '';

  rows.forEach((r, idx) => {
    r.addEventListener('pointerenter', () => {
      pinnedPhase = idx; phase = idx; phaseT = PHASES[idx][1] * 0.45; ensureLoop();
    }, { passive: true });
    r.addEventListener('pointerleave', () => { pinnedPhase = -1; }, { passive: true });
    r.addEventListener('click', () => { phase = idx; phaseT = 0; ensureLoop(); });
  });

  function syncDom(ph, pr) {
    if (ph !== lastPhaseName) {
      lastPhaseName = ph;
      rows.forEach(r => r.setAttribute('data-active', String(r.dataset.secPhase === ph)));
    }
    for (let i = 0; i < segFills.length; i++) {
      const fill = i < phase ? 1 : i === phase ? clamp(pr, 0, 1) : 0;
      segFills[i].style.transform = `scaleX(${fill.toFixed(3)})`;
    }
  }

  // ---------- Advance & Frame ----------
  function advance(dt) {
    elapsed += dt;
    coreHit *= Math.exp(-dt * 3.2);
    const ph = PHASES[phase][0];
    const speedMult = ph === 'breakout' ? 1.4 : 1.0;

    // Smoothly interpolate each surface's hardening level
    const hLerp = 1 - Math.exp(-dt * 2.8);
    for (let s = 0; s < SURFACES.length; s++) {
      hardened[s] += (hardenedTarget[s] - hardened[s]) * hLerp;
    }

    for (const p of probes) {
      const e = attackEdges[p.edgeIdx];
      const isHardened = hardened[e.s] > 0.55;
      const prevT = p.t;
      p.t += dt * p.speed * speedMult * (p.burst > 0 ? 1.55 : 1);

      if (isHardened && prevT < 0.62 && p.t >= 0.62) {
        // Hardened client surface rejects the attack right at the boundary!
        emitDust(lay.surfX - 8, lay.surfY[e.s], THREAT);
        p.t = 0; p.burst = 0;
        p.edgeIdx = (p.edgeIdx + 7) % attackEdges.length;
      } else if (!isHardened && prevT < 0.96 && p.t >= 0.96) {
        // Unhardened surface leaks threat through to core!
        coreHit = 1;
        emitDust(lay.coreX - 16, lay.midY, THREAT);
        p.t = 0; p.burst = 0;
        p.edgeIdx = (p.edgeIdx + 7) % attackEdges.length;
      }
    }

    for (const c of cleanPackets) {
      c.t += dt * c.speed;
      if (c.t >= 1) c.t -= 1;
    }
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i];
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.vx *= Math.exp(-dt * 4); d.vy *= Math.exp(-dt * 4);
      d.life -= dt * 1.9;
      if (d.life <= 0) dust.splice(i, 1);
    }

    // Record evolving exposure score (drops smoothly as surfaces harden)
    traceAccum += dt;
    if (traceAccum >= 0.16) {
      traceAccum = 0;
      trace.copyWithin(0, 1);
      let avgHard = 0;
      for (let s = 0; s < SURFACES.length; s++) avgHard += hardened[s];
      avgHard /= SURFACES.length;
      const exp = (1 - avgHard) * 0.84 + 0.05 + (hash(elapsed * 83) - 0.5) * 0.06;
      trace[TRACE_LEN - 1] = clamp(exp, 0.03, 0.96);
    }

    if (pinnedPhase >= 0) {
      phase = pinnedPhase;
      phaseT = (phaseT + dt * 0.5) % PHASES[phase][1];
      return;
    }
    phaseT += dt;
    while (phaseT >= PHASES[phase][1]) {
      phaseT -= PHASES[phase][1];
      const prev = phase;
      phase = (phase + 1) % PHASES.length;
      // Evolve the client's stack: harden a surface on containment & hardening transitions
      if (prev === 1 && phase === 2) hardenNextSurface();
      if (prev === 2 && phase === 3) hardenNextSurface();
    }
  }

  function draw(dt) {
    const live = !reduced.matches;
    if (live && dt > 0) advance(dt);

    const ph = PHASES[phase][0];
    const pr = live ? phaseT / PHASES[phase][1] : 0.6;
    const hc = hardenedCount();
    const stateStr = hc === 0 ? 'EXPOSED' : hc < SURFACES.length ? `HARDENING ${hc}/${SURFACES.length}` : 'MAINTAINED · 5/5';

    ctx.clearRect(0, 0, Wd, Hd);
    ctx.textBaseline = 'alphabetic';

    // Top HUD (clean 12px line matching Backprop)
    ctx.font = '500 12px "JetBrains Mono", ui-monospace, monospace';
    text(`STACK AUDIT · ${stateStr}`, 8, 20, 0.9);

    drawWeightMatrix(ph, pr);
    drawExposureCurve();

    // Connectors: AI model -> attack vectors
    const mxRight = lay.mat.x + lay.mat.s + 6;
    ctx.setLineDash([1.4, 3]);
    ctx.strokeStyle = `rgb(${INK})`;
    ctx.lineWidth = 0.6;
    for (let v = 0; v < VECTORS.length; v++) {
      ctx.globalAlpha = 0.24 + (ph === 'abliteration' ? 0.22 : 0);
      ctx.beginPath();
      ctx.moveTo(mxRight, lay.mat.y + (v + 0.5) * (lay.mat.s / VECTORS.length));
      ctx.lineTo(lay.vecX - 10, lay.vecY[v]);
      ctx.stroke();
    }

    // Dense cross-mesh edges: vectors -> client stack surfaces
    for (let i = 0; i < attackEdges.length; i++) {
      const e = attackEdges[i];
      const isHover = hoverSurf === e.s;
      const isExp = hardened[e.s] < 0.5;
      ctx.globalAlpha = isHover ? 0.68 : (0.16 + e.weight * 0.34 + (isExp && ph === 'breakout' ? 0.14 : 0));
      ctx.strokeStyle = `rgb(${isHover || (isExp && ph === 'breakout') ? THREAT : INK})`;
      ctx.lineWidth = isHover ? 1.05 : 0.55 + e.weight * 0.55;
      ctx.beginPath();
      ctx.moveTo(lay.vecX + 9, lay.vecY[e.v]);
      ctx.lineTo(lay.surfX - 10, lay.surfY[e.s]);
      ctx.stroke();
    }

    // Client stack surfaces -> Core (red/exposed if unhardened, emerald/clean once hardened!)
    for (let s = 0; s < SURFACES.length; s++) {
      const sy = lay.surfY[s];
      const h = hardened[s];
      ctx.globalAlpha = 0.34 + h * 0.28;
      ctx.strokeStyle = `rgb(${h > 0.5 ? GREEN : THREAT})`;
      ctx.lineWidth = 0.75 + h * 0.25;
      ctx.beginPath();
      ctx.moveTo(lay.surfX + 10, sy);
      ctx.lineTo(lay.coreX - 16, lay.midY);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Continuous packets: probes either breach unhardened surfaces to Core, or bounce off hardened ones!
    if (live) {
      for (const p of probes) {
        const e = attackEdges[p.edgeIdx];
        const isHard = hardened[e.s] > 0.55;
        if (p.t < 0.62) {
          drawPulse(lay.vecX + 9, lay.vecY[e.v], lay.surfX - 10, lay.surfY[e.s], p.t / 0.62, p.burst ? 1 : e.weight, THREAT);
        } else if (!isHard) {
          // Breaches through unhardened surface toward Core
          drawPulse(lay.surfX + 10, lay.surfY[e.s], lay.coreX - 16, lay.midY, (p.t - 0.62) / 0.38, 0.95, THREAT);
        }
      }
      // Clean verified traffic flowing from hardened surfaces to Core
      for (const c of cleanPackets) {
        if (hardened[c.s] > 0.5) {
          drawPulse(lay.surfX + 10, lay.surfY[c.s], lay.coreX - 16, lay.midY, c.t, 0.72, GREEN);
        }
      }
    }

    // Deflection / impact dust
    for (const d of dust) {
      ctx.globalAlpha = clamp(d.life, 0, 1) * 0.85;
      ctx.fillStyle = `rgb(${d.col})`;
      ctx.fillRect(d.x - 1.1, d.y - 1.1, 2.2, 2.2);
    }

    // Column headers
    ctx.font = FONT;
    const headY = Math.min(lay.vecY[0], lay.surfY[0]) - 22;
    text('VECTORS', lay.vecX, headY, 0.74, INK, 'center');
    text('YOUR STACK', lay.surfX, headY, 0.82, INK, 'center');
    text('CORE', lay.coreX, headY, 0.82, hc === SURFACES.length ? GREEN : INK, 'center');

    // Vector clusters
    for (let v = 0; v < VECTORS.length; v++) {
      const col = ph === 'abliteration' || ph === 'breakout' ? THREAT : INK;
      drawCluster(lay.vecX, lay.vecY[v], 4, 2.4, 0.8, col, 0.75, v * 17 + 1);
      text(VECTORS[v], lay.vecX, lay.vecY[v] + 15, 0.7, INK, 'center');
    }

    // Client stack surfaces (evolving from crimson/exposed -> cobalt/auditing -> emerald/hardened!)
    const auditSweep = ph === 'hardening' ? smooth(pr) : -1;
    for (let s = 0; s < SURFACES.length; s++) {
      const sy = lay.surfY[s];
      const h = hardened[s];
      const isHover = hoverSurf === s;
      const isAuditing = (ph === 'containment' && s === auditTarget) ||
        (auditSweep >= 0 && Math.abs(s / (SURFACES.length - 1) - auditSweep) < 0.18);

      const col = isAuditing ? SCAN : h > 0.5 ? GREEN : THREAT;
      drawCluster(lay.surfX, sy, 4, 2.7, 0.85, col, 0.72 + h * 0.25, 100 + s * 23);
      if (h > 0.35 || isAuditing || isHover) {
        bracket(lay.surfX, sy, isHover ? 24 : 21, col, isHover ? 0.95 : Math.max(h * 0.85, isAuditing ? 0.85 : 0));
      }
      text(SURFACES[s].label, lay.surfX, sy + 16, 0.82, h > 0.5 ? GREEN : THREAT, 'center');
      if (isHover) {
        text(h > 0.5 ? `${SURFACES[s].control} · click to expose` : 'VULNERABLE · click to harden', lay.surfX, sy - 16, 0.88, col, 'center');
      } else if (isAuditing) {
        text(h > 0.5 ? 'VERIFIED' : 'AUDITING', lay.surfX, sy - 15, 0.86, SCAN, 'center');
      }
    }

    // Core enclave (turns from stressed ink/crimson when breached to calm emerald when stack is hardened)
    const coreCol = coreHit > 0.25 ? THREAT : hc === SURFACES.length ? GREEN : INK;
    drawCluster(lay.coreX, lay.midY, 5, 2.8, 0.85, coreCol, 0.9, 307);
    bracket(lay.coreX, lay.midY, 30 + coreHit * 6, coreCol, 0.78 + coreHit * 0.2, 1.0);

    // Bottom phase line (matching Backprop)
    const eq = {
      abliteration: ['AUDIT', 'mapping attack paths across auth, API, model, and VPC', SCAN],
      breakout: ['STRESS TEST', 'replaying AI-speed probes against unhardened endpoints', THREAT],
      containment: ['HARDEN', 'patching architecture, least-privilege policies & isolation', GREEN],
      hardening: ['MAINTAIN', 'continuous verification as your codebase and models ship', GREEN],
    }[ph];
    const ex = lay.vecX - 10, ey = Hd - 14;
    ctx.font = '500 8.5px "JetBrains Mono", ui-monospace, monospace';
    text(eq[0], ex, ey, 0.92, eq[2]);
    const lw = ctx.measureText(eq[0]).width;
    ctx.font = FONT;
    text(eq[1], ex + lw + 12, ey, 0.78, INK);

    ctx.globalAlpha = 1;
    syncDom(ph, pr);
  }

  // ---------- Loop & Interaction ----------
  let raf = 0, last = 0, visible = true;
  function tick(time) {
    const dt = last ? Math.min((time - last) / 1000, 0.05) : 1 / 60;
    last = time;
    draw(dt);
    if (visible && !document.hidden && !reduced.matches) raf = requestAnimationFrame(tick);
    else { raf = 0; last = 0; }
  }
  function ensureLoop() {
    if (reduced.matches) { draw(0); return; }
    if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); }
  }

  function nearestSurface(x, y) {
    let best = 26, hit = -1;
    for (let i = 0; i < SURFACES.length; i++) {
      const d = Math.hypot(lay.surfX - x, lay.surfY[i] - y);
      if (d < best) { best = d; hit = i; }
    }
    return hit;
  }

  stage.addEventListener('pointermove', e => {
    hoverSurf = nearestSurface(e.clientX - rect.left, e.clientY - rect.top);
    stage.style.cursor = hoverSurf >= 0 ? 'pointer' : 'default';
    if (reduced.matches) draw(0);
  }, { passive: true });
  stage.addEventListener('pointerleave', () => {
    hoverSurf = -1; stage.style.cursor = 'default'; if (reduced.matches) draw(0);
  }, { passive: true });
  stage.addEventListener('click', e => {
    rect = stage.getBoundingClientRect();
    const s = nearestSurface(e.clientX - rect.left, e.clientY - rect.top);
    if (s >= 0) {
      // Toggle surface between exposed & hardened so visitors can test breaches vs defense live
      hardenedTarget[s] = hardenedTarget[s] > 0.5 ? 0 : 1;
      if (hardenedTarget[s] === 0) {
        auditCycles = 0;
        let launched = 0;
        for (let i = 0; i < probes.length && launched < 4; i++) {
          if (attackEdges[probes[i].edgeIdx].s === s) {
            probes[i].t = launched * 0.1;
            probes[i].burst = 1;
            launched++;
          }
        }
      }
      ensureLoop();
    }
  });

  new IntersectionObserver(entries => {
    visible = entries[0] ? entries[0].isIntersecting : true;
    if (visible) { rect = stage.getBoundingClientRect(); ensureLoop(); }
    else if (raf) { cancelAnimationFrame(raf); raf = 0; last = 0; }
  }, { threshold: 0.02 }).observe(stage);

  window.addEventListener('scroll', () => { rect = stage.getBoundingClientRect(); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; last = 0; }
    else ensureLoop();
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches && raf) { cancelAnimationFrame(raf); raf = 0; draw(0); }
    else ensureLoop();
  });

  new ResizeObserver(resize).observe(stage);
  resize();
  ensureLoop();
  document.fonts && document.fonts.ready.then(() => draw(0));
})();
