/*
 * Backpropagation specimen: a real 2-8-8-1 network trained live in the browser.
 * Full-batch Adam on a small 2D dataset. The animated pass follows the hardest
 * sample of each cycle: forward activations, loss, backward deltas, weight update.
 */
(() => {
  const stage = document.getElementById('research-stage');
  if (!stage) return;
  const canvas = stage.querySelector('.research-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const hash = n => { const f = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return f - Math.floor(f); };
  function rng(seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // ---------- Model ----------
  const SIZES = [2, 8, 8, 1], L = SIZES.length - 1;
  const LR = 0.03, B1 = 0.9, B2 = 0.999, EPS = 1e-8, STEPS_PER_CYCLE = 10;
  const DATASETS = ['RING', 'XOR', 'MOONS'];
  const PHASES = [['forward', 4.2], ['loss', 1.8], ['backward', 4.2], ['update', 2.2]];

  let W, Bv, mW, vW, mB, vB, adamT = 0;
  let dispW, deltaW;

  function makeData(name, r) {
    const pts = [];
    for (let i = 0; i < 72; i++) {
      let x, y, c;
      if (name === 'RING') {
        c = i % 2;
        const a = r() * Math.PI * 2, rad = c ? r() * 0.38 : 0.6 + r() * 0.3;
        x = Math.cos(a) * rad + (r() - 0.5) * 0.06;
        y = Math.sin(a) * rad + (r() - 0.5) * 0.06;
      } else if (name === 'XOR') {
        do { x = r() * 1.8 - 0.9; y = r() * 1.8 - 0.9; } while (Math.abs(x) < 0.1 || Math.abs(y) < 0.1);
        c = x * y > 0 ? 1 : 0;
      } else {
        c = i % 2;
        const t = r() * Math.PI;
        if (c) { x = -0.28 + Math.cos(t) * 0.58; y = 0.12 - Math.sin(t) * 0.58; }
        else { x = 0.28 + Math.cos(t) * 0.58; y = -0.12 + Math.sin(t) * 0.58; }
        x += (r() - 0.5) * 0.1; y += (r() - 0.5) * 0.1;
      }
      pts.push({ x: clamp(x, -0.96, 0.96), y: clamp(y, -0.96, 0.96), c, pred: 0.5, fresh: 0 });
    }
    return pts;
  }

  function initNet(r) {
    W = []; Bv = []; mW = []; vW = []; mB = []; vB = []; adamT = 0;
    for (let l = 0; l < L; l++) {
      const fanIn = SIZES[l], fanOut = SIZES[l + 1], s = Math.sqrt(6 / (fanIn + fanOut));
      W[l] = []; mW[l] = []; vW[l] = [];
      for (let j = 0; j < fanOut; j++) {
        W[l][j] = new Float64Array(fanIn);
        mW[l][j] = new Float64Array(fanIn);
        vW[l][j] = new Float64Array(fanIn);
        for (let i = 0; i < fanIn; i++) W[l][j][i] = (r() * 2 - 1) * s;
      }
      Bv[l] = new Float64Array(fanOut).map(() => (r() - 0.5) * 0.2);
      mB[l] = new Float64Array(fanOut);
      vB[l] = new Float64Array(fanOut);
    }
  }
  const cloneW = src => src.map(layer => layer.map(row => Float64Array.from(row)));

  function forward(x, y) {
    const a = [[x, y]];
    for (let l = 0; l < L; l++) {
      const prev = a[l], out = new Array(SIZES[l + 1]);
      for (let j = 0; j < SIZES[l + 1]; j++) {
        let z = Bv[l][j];
        const w = W[l][j];
        for (let i = 0; i < prev.length; i++) z += w[i] * prev[i];
        out[j] = l < L - 1 ? Math.tanh(z) : 1 / (1 + Math.exp(-z));
      }
      a.push(out);
    }
    return a;
  }
  function backward(a, target) {
    const d = [];
    d[L] = [a[L][0] - target]; // sigmoid + binary cross-entropy
    for (let l = L - 1; l >= 1; l--) {
      d[l] = new Array(SIZES[l]);
      for (let i = 0; i < SIZES[l]; i++) {
        let s = 0;
        for (let j = 0; j < SIZES[l + 1]; j++) s += W[l][j][i] * d[l + 1][j];
        d[l][i] = s * (1 - a[l][i] * a[l][i]);
      }
    }
    return d;
  }
  const bce = (p, y) => { p = clamp(p, 1e-6, 1 - 1e-6); return -(y * Math.log(p) + (1 - y) * Math.log(1 - p)); };

  function evaluate() {
    let loss = 0, correct = 0;
    for (const p of data) {
      const out = forward(p.x, p.y)[L][0];
      p.pred = out;
      loss += bce(out, p.c);
      if ((out > 0.5) === (p.c === 1)) correct++;
    }
    return { loss: loss / data.length, acc: correct / data.length };
  }

  function trainStep() {
    const gW = W.map(layer => layer.map(row => new Float64Array(row.length)));
    const gB = Bv.map(b => new Float64Array(b.length));
    for (const p of data) {
      const a = forward(p.x, p.y), d = backward(a, p.c);
      for (let l = 0; l < L; l++) {
        for (let j = 0; j < SIZES[l + 1]; j++) {
          const dj = d[l + 1][j], g = gW[l][j], al = a[l];
          gB[l][j] += dj;
          for (let i = 0; i < al.length; i++) g[i] += dj * al[i];
        }
      }
    }
    const n = data.length;
    adamT++;
    const c1 = 1 - Math.pow(B1, adamT), c2 = 1 - Math.pow(B2, adamT);
    let norm = 0;
    for (let l = 0; l < L; l++) {
      for (let j = 0; j < SIZES[l + 1]; j++) {
        for (let i = 0; i < SIZES[l]; i++) {
          const g = gW[l][j][i] / n;
          norm += g * g;
          mW[l][j][i] = B1 * mW[l][j][i] + (1 - B1) * g;
          vW[l][j][i] = B2 * vW[l][j][i] + (1 - B2) * g * g;
          W[l][j][i] -= LR * (mW[l][j][i] / c1) / (Math.sqrt(vW[l][j][i] / c2) + EPS);
        }
        const g = gB[l][j] / n;
        norm += g * g;
        mB[l][j] = B1 * mB[l][j] + (1 - B1) * g;
        vB[l][j] = B2 * vB[l][j] + (1 - B2) * g * g;
        Bv[l][j] -= LR * (mB[l][j] / c1) / (Math.sqrt(vB[l][j] / c2) + EPS);
      }
    }
    return Math.sqrt(norm);
  }

  // ---------- Decision field ----------
  const G = 30;
  const fieldTarget = new Float32Array(G * G).fill(0.5);
  const fieldShown = new Float32Array(G * G).fill(0.5);
  function computeField() {
    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        const x = -1 + (gx + 0.5) * 2 / G, y = -1 + (gy + 0.5) * 2 / G;
        fieldTarget[gy * G + gx] = forward(x, y)[L][0];
      }
    }
  }

  // ---------- Training state ----------
  let data = [], datasetIdx = 0, resetCount = 0, epoch = 0, epochCap = 1400;
  let history = [], stats = { loss: 0, acc: 0, norm: 0 };
  let sampleIdx = 0, sampleA = null, sampleD = null, sampleLoss = 0;
  let phase = 0, phaseT = 0, converged = 0, pointsAlpha = 1;

  function reset(next) {
    if (next) datasetIdx = (datasetIdx + 1) % DATASETS.length;
    resetCount++;
    const r = rng(1013 + datasetIdx * 97 + resetCount * 31);
    data = makeData(DATASETS[datasetIdx], r);
    initNet(r);
    epoch = 0; epochCap = 1400; converged = 0; history = [];
    const s = evaluate();
    stats = { loss: s.loss, acc: s.acc, norm: 0 };
    history.push(s.loss);
    computeField();
    dispW = cloneW(W);
    deltaW = W.map(layer => layer.map(row => new Float64Array(row.length)));
    pointsAlpha = 0;
    phase = 0; phaseT = 0;
    pickSample();
  }

  function setSample(idx) {
    sampleIdx = idx;
    const p = data[idx];
    sampleA = forward(p.x, p.y);
    sampleD = backward(sampleA, p.c);
    sampleLoss = bce(sampleA[L][0], p.c);
  }
  function pickSample() {
    // Follow the worst mistake among a random handful of samples.
    let best = 0, bestLoss = -1;
    for (let k = 0; k < 12; k++) {
      const idx = Math.floor(Math.random() * data.length), p = data[idx];
      const l = bce(p.pred, p.c);
      if (l > bestLoss) { bestLoss = l; best = idx; }
    }
    setSample(best);
  }

  function onUpdate() {
    if (converged > 0) { converged++; return; }
    const prev = cloneW(W);
    let norm = 0;
    for (let k = 0; k < STEPS_PER_CYCLE; k++) {
      norm = trainStep();
      epoch++;
      history.push(evaluate().loss);
    }
    const s = evaluate();
    stats = { loss: s.loss, acc: s.acc, norm };
    let maxD = 1e-9;
    for (let l = 0; l < L; l++) for (let j = 0; j < SIZES[l + 1]; j++) for (let i = 0; i < SIZES[l]; i++) {
      const dv = Math.abs(W[l][j][i] - prev[l][j][i]);
      deltaW[l][j][i] = dv;
      if (dv > maxD) maxD = dv;
    }
    for (let l = 0; l < L; l++) for (let j = 0; j < SIZES[l + 1]; j++) for (let i = 0; i < SIZES[l]; i++) deltaW[l][j][i] /= maxD;
    computeField();
    if ((s.acc === 1 && s.loss < 0.08) || s.loss < 0.04 || epoch >= epochCap) converged = 1;
  }
  function onCycle() {
    if (converged >= 4) { reset(true); return; }
    pickSample();
  }
  function advance(dt) {
    if (pinnedPhase >= 0) {
      phase = pinnedPhase;
      phaseT = (phaseT + dt * 0.55) % PHASES[phase][1];
      return;
    }
    phaseT += dt;
    while (phaseT >= PHASES[phase][1]) {
      phaseT -= PHASES[phase][1];
      phase = (phase + 1) % PHASES.length;
      if (phase === 3) onUpdate();
      if (phase === 0) onCycle();
    }
  }

  function inject(x, y) {
    const p = forward(x, y)[L][0];
    const c = p > 0.5 ? 0 : 1; // a counterexample to the current belief
    data.push({ x, y, c, pred: p, fresh: 1 });
    if (data.length > 110) data.splice(72, 1);
    converged = 0;
    epochCap = epoch + 700;
    setSample(data.length - 1);
    ensureLoop();
  }

  // ---------- Layout ----------
  let Wd = 1, Hd = 1, dpr = 1, rect = { left: 0, top: 0 };
  let narrow = false;
  const lay = { field: null, curve: null, net: null, nodes: [], loss: [0, 0] };

  function layout() {
    narrow = Wd < 640;
    if (!narrow) {
      const fs = clamp(Wd * 0.27, 150, 220);
      lay.field = { x: 6, y: Math.max(64, Hd * 0.5 - fs * 0.5 - 44), s: fs };
      lay.curve = { x: 6, y: lay.field.y + fs + 44, w: fs, h: 56 };
      lay.net = { x0: fs + 92, x1: Wd - 44, y0: 92, y1: Hd - 72 };
    } else {
      const fs = clamp(Wd * 0.4, 120, 190);
      lay.net = { x0: 34, x1: Wd - 40, y0: 74, y1: Hd * 0.56 };
      lay.field = { x: 6, y: Hd * 0.62, s: Math.min(fs, Hd * 0.32) };
      lay.curve = { x: lay.field.s + 34, y: lay.field.y + 24, w: Wd - lay.field.s - 42, h: 52 };
    }
    const n = lay.net, span = n.x1 - n.x0 - 76;
    const mid = (n.y0 + n.y1) / 2, gap = Math.min(44, (n.y1 - n.y0) / 8);
    lay.nodes = [];
    for (let l = 0; l <= L; l++) {
      const x = n.x0 + span * l / L, count = SIZES[l], g = count <= 2 ? gap * 1.8 : gap;
      lay.nodes[l] = Array.from({ length: count }, (_, i) => [x, mid + (i - (count - 1) / 2) * g]);
    }
    lay.loss = [n.x1 - 6, mid];
  }

  function resize() {
    rect = stage.getBoundingClientRect();
    Wd = Math.max(1, rect.width); Hd = Math.max(1, rect.height);
    dpr = Math.min(devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(Wd * dpr); canvas.height = Math.round(Hd * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
    draw(0);
  }

  // ---------- Palette ----------
  const INK = '7,18,30', GREEN = '6,94,38', GRAD = '12,68,168', CLASS1 = '8,102,42', CLASS0 = '14,58,138';
  const FONT = '8px "JetBrains Mono", ui-monospace, monospace';

  function bracket(x, y, size, color, alpha) {
    ctx.globalAlpha = alpha; ctx.strokeStyle = `rgb(${color})`; ctx.lineWidth = 0.85;
    const cx = Math.round(x) + 0.5, cy = Math.round(y) + 0.5, s = size / 2, k = size * 0.28;
    ctx.beginPath();
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
      ctx.moveTo(cx + dx * s, cy + dy * (s - k)); ctx.lineTo(cx + dx * s, cy + dy * s); ctx.lineTo(cx + dx * (s - k), cy + dy * s);
    }
    ctx.stroke();
  }
  function text(str, x, y, alpha = 0.82, color = INK, align = 'left') {
    ctx.globalAlpha = alpha; ctx.fillStyle = `rgb(${color})`; ctx.textAlign = align; ctx.fillText(str, x, y); ctx.textAlign = 'left';
  }
  const fmt = v => (v < 0 ? '−' : ' ') + Math.abs(v).toFixed(3);

  // ---------- Reveal timing (continuous, zero hard snaps) ----------
  function forwardReveal(k, ph, pr) {
    if (ph === 'forward') {
      if (k === 0) return 1;
      const wave = pr * 3.15;
      return ease(clamp((wave - (k - 1) * 0.92 - 0.55) / 0.55, 0, 1));
    }
    if (ph === 'update') {
      // Gently relax activations toward the next cycle at the very end of update
      return 1 - ease(clamp((pr - 0.72) / 0.28, 0, 1)) * 0.45;
    }
    return 1;
  }
  function backReveal(k, ph, pr) {
    if (ph === 'forward') return 0;
    if (ph === 'loss') return k === L ? ease(clamp((pr - 0.48) / 0.45, 0, 1)) : 0;
    if (ph === 'backward') {
      if (k === L) return 1;
      const wave = pr * 3.15;
      const step = L - 1 - k; // k=2 -> step=0, k=1 -> step=1
      return ease(clamp((wave - step * 0.92 - 0.55) / 0.55, 0, 1));
    }
    // Smoothly dissolve gradient brackets during update so next forward pass starts cleanly
    return 1 - ease(clamp((pr - 0.35) / 0.65, 0, 1));
  }
  function layerGlow(l, ph, pr) {
    if (ph === 'forward') {
      const wave = pr * 3.15;
      return Math.exp(-Math.pow(wave - (l * 0.92 + 0.5), 2) * 2.4);
    }
    if (ph === 'backward') {
      const wave = pr * 3.15;
      const step = 2 - l;
      return Math.exp(-Math.pow(wave - (step * 0.92 + 0.5), 2) * 2.4);
    }
    return 0;
  }

  // ---------- Drawing ----------
  function drawHUD(ph, pr) {
    ctx.font = '500 12px "JetBrains Mono", ui-monospace, monospace';
    text(`BACKPROPAGATION · ${DATASETS[datasetIdx]} · EPOCH ${String(epoch).padStart(4, '0')}${converged ? ' · CONVERGED' : ''}`, 6, 20, 0.9);
    const eq = {
      forward: ['FORWARD', 'a[l+1] = tanh(W[l]·a[l] + b[l])', GREEN],
      loss: ['LOSS', 'L = −[ y·log ŷ + (1−y)·log(1−ŷ) ]', INK],
      backward: ['BACKWARD', 'δ[l] = (W[l]ᵀ·δ[l+1]) ⊙ (1 − a[l]²)', GRAD],
      update: ['UPDATE', 'W ← W − η · m̂ / (√v̂ + ε)', INK],
    }[ph];
    const x = narrow ? 6 : lay.net.x0 - 10, y = Hd - 14;
    ctx.font = '500 8.5px "JetBrains Mono", ui-monospace, monospace';
    text(eq[0], x, y, 0.92, eq[2]);
    const w = ctx.measureText(eq[0]).width;
    ctx.font = FONT;
    text(eq[1], x + w + 12, y, 0.78);
    // phase progress ticks
    const tx = x, ty = y - 14;
    PHASES.forEach(([name], i) => {
      const active = name === ph;
      ctx.globalAlpha = active ? 0.92 : 0.34;
      ctx.fillStyle = `rgb(${INK})`;
      const segW = 26;
      ctx.fillRect(tx + i * (segW + 4), ty, active ? segW * clamp(pr, 0, 1) : segW, 1.5);
      if (active) { ctx.globalAlpha = 0.26; ctx.fillRect(tx + i * (segW + 4), ty, segW, 1.5); }
    });
  }

  function drawField(live) {
    const f = lay.field, cs = f.s / G;
    ctx.font = FONT;
    text('INPUT SPACE  x₁ × x₂', f.x, f.y - 12, 0.82);
    bracket(f.x + 5, f.y + 5, 10, INK, 0.55);
    bracket(f.x + f.s - 5, f.y + 5, 10, INK, 0.55);
    bracket(f.x + 5, f.y + f.s - 5, 10, INK, 0.55);
    bracket(f.x + f.s - 5, f.y + f.s - 5, 10, INK, 0.55);
    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        const p = fieldShown[gy * G + gx], conf = Math.abs(p - 0.5) * 2;
        const px = f.x + gx * cs, py = f.y + gy * cs;
        if (conf < 0.12) {
          ctx.globalAlpha = 0.65 * (1 - conf / 0.12) + 0.14;
          ctx.fillStyle = `rgb(${INK})`;
          ctx.fillRect(px + cs * 0.28, py + cs * 0.28, cs * 0.44, cs * 0.44);
          continue;
        }
        ctx.globalAlpha = 0.14 + conf * 0.38;
        ctx.fillStyle = `rgb(${p > 0.5 ? CLASS1 : CLASS0})`;
        ctx.fillRect(px + cs * 0.17, py + cs * 0.17, cs * 0.66, cs * 0.66);
      }
    }
    const t = performance.now() / 1000;
    data.forEach((p, idx) => {
      const x = f.x + (p.x + 1) / 2 * f.s, y = f.y + (p.y + 1) / 2 * f.s;
      const wrong = (p.pred > 0.5) !== (p.c === 1);
      const a = pointsAlpha;
      if (wrong && live) {
        ctx.globalAlpha = a * (0.38 + 0.22 * Math.sin(t * 1.4 + idx));
        ctx.strokeStyle = `rgb(${INK})`; ctx.lineWidth = 0.7;
        ctx.strokeRect(Math.round(x) - 4.5, Math.round(y) - 4.5, 9, 9);
      }
      if (p.c === 1) {
        ctx.globalAlpha = a; ctx.fillStyle = `rgb(${CLASS1})`;
        ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
      } else {
        ctx.globalAlpha = a; ctx.strokeStyle = `rgb(${CLASS0})`; ctx.lineWidth = 1.1;
        ctx.strokeRect(Math.round(x) - 1.5, Math.round(y) - 1.5, 4, 4);
      }
      if (p.fresh > 0.01) bracket(x, y, 14, INK, p.fresh * 0.85);
    });
    // highlighted sample
    const s = data[sampleIdx];
    if (s) bracket(f.x + (s.x + 1) / 2 * f.s, f.y + (s.y + 1) / 2 * f.s, 13, INK, 0.92);
  }

  function drawConnectors(ph, pr) {
    const s = data[sampleIdx];
    if (!s) return;
    const f = lay.field, sx = f.x + (s.x + 1) / 2 * f.s, sy = f.y + (s.y + 1) / 2 * f.s;
    const boost = ph === 'forward' ? 1 - clamp(pr * 3, 0, 1) : 0;
    ctx.globalAlpha = 0.36 + boost * 0.45;
    ctx.strokeStyle = `rgb(${INK})`; ctx.lineWidth = 0.7; ctx.setLineDash([1.5, 3.5]);
    ctx.beginPath();
    for (const [nx, ny] of lay.nodes[0]) { ctx.moveTo(sx + 7, sy); ctx.lineTo(nx - 10, ny); }
    ctx.stroke(); ctx.setLineDash([]);
  }

  function drawEdges(ph, pr) {
    const flash = ph === 'update' ? Math.sin(clamp(pr, 0, 1) * Math.PI) : 0;
    ctx.setLineDash([1.4, 3]);
    for (let l = 0; l < L; l++) {
      const glow = layerGlow(l, ph, pr);
      for (let j = 0; j < SIZES[l + 1]; j++) {
        const [x1, y1] = lay.nodes[l + 1][j];
        for (let i = 0; i < SIZES[l]; i++) {
          const [x0, y0] = lay.nodes[l][i];
          const w = dispW[l][j][i], m = Math.min(Math.abs(w) / 2.2, 1);
          ctx.globalAlpha = 0.18 + m * 0.52 + glow * 0.22;
          ctx.strokeStyle = `rgb(${w >= 0 ? GREEN : INK})`;
          ctx.lineWidth = 0.55 + m * 1.05 + glow * 0.25;
          ctx.beginPath(); ctx.moveTo(x0 + 8, y0); ctx.lineTo(x1 - 8, y1); ctx.stroke();
        }
      }
    }
    ctx.setLineDash([]);
    if (flash > 0.01) {
      for (let l = 0; l < L; l++) for (let j = 0; j < SIZES[l + 1]; j++) for (let i = 0; i < SIZES[l]; i++) {
        const d = deltaW[l][j][i];
        if (d < 0.15) continue;
        const [x0, y0] = lay.nodes[l][i], [x1, y1] = lay.nodes[l + 1][j];
        ctx.globalAlpha = flash * d * 0.7;
        ctx.strokeStyle = `rgb(${GRAD})`; ctx.lineWidth = 0.7 + d * 1.2;
        ctx.beginPath(); ctx.moveTo(x0 + 8, y0); ctx.lineTo(x1 - 8, y1); ctx.stroke();
      }
    }
    // output -> loss link
    const [ox, oy] = lay.nodes[L][0];
    const lossGlow = ph === 'loss' ? Math.sin(clamp(pr, 0, 1) * Math.PI) : 0;
    ctx.globalAlpha = 0.48 + lossGlow * 0.35; ctx.strokeStyle = `rgb(${INK})`; ctx.lineWidth = 0.8 + lossGlow * 0.35; ctx.setLineDash([1.4, 3]);
    ctx.beginPath(); ctx.moveTo(ox + 9, oy); ctx.lineTo(lay.loss[0] - 14, lay.loss[1]); ctx.stroke(); ctx.setLineDash([]);
  }

  function pulse(x0, y0, x1, y1, p, m, color) {
    for (let k = 0; k < 5; k++) {
      const t = p - k * 0.032;
      if (t <= 0 || t >= 1) continue;
      const env = Math.min(1, t / 0.12) * Math.min(1, (1 - t) / 0.12);
      const x = mix(x0, x1, t), y = mix(y0, y1, t), size = (1.6 + m * 2.5) * (1 - k * 0.15);
      ctx.globalAlpha = (0.42 + m * 0.58) * (1 - k * 0.2) * env;
      ctx.fillStyle = `rgb(${color})`;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }
  }

  function drawPulses(ph, pr) {
    if (!sampleA) return;
    if (ph === 'forward') {
      const wave = pr * 3.15;
      for (let l = 0; l < L; l++) {
        const p = wave - l * 0.92;
        if (p <= -0.02 || p >= 1.18) continue;
        let maxM = 1e-6;
        for (let j = 0; j < SIZES[l + 1]; j++) for (let i = 0; i < SIZES[l]; i++) maxM = Math.max(maxM, Math.abs(W[l][j][i] * sampleA[l][i]));
        for (let j = 0; j < SIZES[l + 1]; j++) for (let i = 0; i < SIZES[l]; i++) {
          const [x0, y0] = lay.nodes[l][i], [x1, y1] = lay.nodes[l + 1][j];
          pulse(x0 + 8, y0, x1 - 8, y1, p, Math.abs(W[l][j][i] * sampleA[l][i]) / maxM, GREEN);
        }
      }
    } else if (ph === 'backward') {
      const wave = pr * 3.15;
      for (let step = 0; step < L; step++) {
        const l = 2 - step;
        const p = wave - step * 0.92;
        if (p <= -0.02 || p >= 1.18) continue;
        let maxM = 1e-9;
        for (let j = 0; j < SIZES[l + 1]; j++) for (let i = 0; i < SIZES[l]; i++) maxM = Math.max(maxM, Math.abs(W[l][j][i] * sampleD[l + 1][j]));
        for (let j = 0; j < SIZES[l + 1]; j++) for (let i = 0; i < SIZES[l]; i++) {
          const [x0, y0] = lay.nodes[l][i], [x1, y1] = lay.nodes[l + 1][j];
          pulse(x1 - 8, y1, x0 + 8, y0, p, Math.abs(W[l][j][i] * sampleD[l + 1][j]) / maxM, GRAD);
        }
      }
    } else if (ph === 'loss') {
      const [ox, oy] = lay.nodes[L][0], [lx, ly] = lay.loss;
      const outP = pr * 2.15;
      if (outP > 0 && outP < 1.16) pulse(ox + 9, oy, lx - 14, ly, outP, 0.95, GREEN);
      const backP = (pr - 0.46) * 2.15;
      if (backP > 0 && backP < 1.16) pulse(lx - 14, ly, ox + 9, oy, backP, 0.95, GRAD);
    }
  }

  function drawNodeCluster(x, y, v, reveal, seed) {
    const px = 2.6, gap = 0.85, n = 4, size = n * px + (n - 1) * gap;
    const ox = Math.round(x - size / 2), oy = Math.round(y - size / 2);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const h = hash(seed * 31 + r * 7 + c * 3);
      if (h < 0.07) continue;
      const k = clamp(Math.abs(v) * reveal * (0.7 + h * 0.6), 0, 1);
      let col;
      if (v >= 0) col = `${Math.round(mix(28, 4, k))},${Math.round(mix(92, 82, k))},${Math.round(mix(52, 30, k))}`;
      else col = `${Math.round(mix(24, 8, k))},${Math.round(mix(52, 32, k))},${Math.round(mix(92, 78, k))}`;
      ctx.globalAlpha = 0.48 + k * 0.52;
      ctx.fillStyle = `rgb(${col})`;
      ctx.fillRect(ox + c * (px + gap), oy + r * (px + gap), px, px);
    }
  }

  function drawNodes(ph, pr) {
    if (!sampleA) return;
    ctx.font = FONT;
    const headers = ['x', 'h₁ · tanh', 'h₂ · tanh', 'ŷ · σ'];
    for (let l = 0; l <= L; l++) {
      const top = lay.nodes[l][0];
      text(headers[l], top[0], Math.min(top[1] - 20, lay.nodes[1][0][1] - 20), 0.76, INK, 'center');
      const fr = forwardReveal(l, ph, pr), br = l > 0 ? backReveal(l, ph, pr) : 0;
      let maxD = 1e-9;
      if (l > 0) for (const dv of sampleD[l]) maxD = Math.max(maxD, Math.abs(dv));
      lay.nodes[l].forEach(([x, y], i) => {
        const raw = sampleA[l][i], v = l === L ? raw * 2 - 1 : raw;
        drawNodeCluster(x, y, v, fr, l * 17 + i);
        if (br > 0.01) {
          const m = Math.abs(sampleD[l][i]) / maxD;
          bracket(x, y, 19 + m * 9, GRAD, br * (0.45 + m * 0.55));
        }
      });
    }
    // input + output values
    lay.nodes[0].forEach(([x, y], i) => text(`x${i ? '₂' : '₁'}${fmt(sampleA[0][i])}`, x, y - 13, 0.82, INK, 'center'));
    const [ox, oy] = lay.nodes[L][0];
    const fo = forwardReveal(L, ph, pr);
    text(`ŷ ${sampleA[L][0].toFixed(3)}`, ox, oy + 22, 0.45 + fo * 0.45, INK, 'center');
    if (backReveal(L, ph, pr) > 0.01) text(`δ${fmt(sampleD[L][0])}`, ox, oy + 34, backReveal(L, ph, pr) * 0.92, GRAD, 'center');
  }

  function drawLossNode(ph, pr) {
    const [lx, ly] = lay.loss, s = data[sampleIdx];
    if (!s) return;
    const active = ph === 'loss';
    const k = clamp(sampleLoss / 2, 0.2, 1);
    const px = 2.6, gap = 0.85, n = 4, size = n * px + (n - 1) * gap;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      ctx.globalAlpha = (0.45 + k * 0.55) * (active ? 1 : 0.82);
      ctx.fillStyle = `rgb(${INK})`;
      ctx.fillRect(Math.round(lx - size / 2) + c * (px + gap), Math.round(ly - size / 2) + r * (px + gap), px, px);
    }
    bracket(lx, ly, 26, INK, active ? 0.92 : 0.58);
    ctx.font = FONT;
    text('L · BCE', lx, ly - 24, 0.76, INK, 'center');
    text(`y = ${s.c}`, lx, ly + 26, 0.8, INK, 'center');
    text(`ℓ ${sampleLoss.toFixed(3)}`, lx, ly + 38, active ? 0.95 : 0.72, INK, 'center');
  }

  function drawCurve() {
    const c = lay.curve;
    ctx.font = FONT;
    text('LOSS', c.x, c.y - 8, 0.8);
    text(stats.loss.toFixed(4), c.x + c.w, c.y - 8, 0.9, INK, 'right');
    ctx.globalAlpha = 0.34; ctx.fillStyle = `rgb(${INK})`;
    ctx.fillRect(c.x, c.y + c.h, c.w, 0.7);
    ctx.globalAlpha = 0.16;
    ctx.fillRect(c.x, c.y, c.w, 0.5);
    ctx.fillRect(c.x, c.y + c.h * 0.5, c.w, 0.5);
    const n = history.length;
    if (n > 1) {
      const span = Math.max(n - 1, 300), maxL = Math.max(0.75, history[0]);
      for (let x = 0; x <= c.w; x += 2) {
        const idx = Math.round(x / c.w * span);
        if (idx >= n) break;
        const y = c.y + c.h - clamp(history[idx] / maxL, 0, 1) * c.h;
        ctx.globalAlpha = 0.9; ctx.fillStyle = `rgb(${GREEN})`;
        ctx.fillRect(Math.round(c.x + x), Math.round(y), 1.8, 1.8);
      }
      const lastX = c.x + Math.min(1, (n - 1) / span) * c.w;
      const lastY = c.y + c.h - clamp(history[n - 1] / maxL, 0, 1) * c.h;
      ctx.globalAlpha = 0.98; ctx.fillStyle = `rgb(${INK})`;
      ctx.fillRect(Math.round(lastX) - 1.5, Math.round(lastY) - 1.5, 3, 3);
    }
    text(`ACC ${Math.round(stats.acc * 100)}%`, c.x, c.y + c.h + 14, 0.78);
    text(`‖∇‖ ${stats.norm.toExponential(1)}`, c.x + c.w, c.y + c.h + 14, 0.78, INK, 'right');
  }

  // ---------- Hover ----------
  let hoverNode = null, hoverField = null;
  function drawTooltip() {
    ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
    if (hoverNode && sampleA) {
      const { l, i } = hoverNode, [x, y] = lay.nodes[l][i];
      const name = ['X', 'H1', 'H2', 'Ŷ'][l];
      const lines = [`${name}·${String(i + 1).padStart(2, '0')}   a${fmt(sampleA[l][i])}`];
      lines.push(l > 0 ? `δ${fmt(sampleD[l][i])}   b${fmt(Bv[l - 1][i])}` : 'input feature');
      const w = Math.max(...lines.map(s => ctx.measureText(s).width)) + 16;
      const bx = clamp(x + 16, 4, Wd - w - 4), by = clamp(y - 44, 4, Hd - 40);
      ctx.globalAlpha = 0.94; ctx.fillStyle = 'rgb(236,246,255)'; ctx.fillRect(bx, by, w, 36);
      ctx.fillStyle = `rgb(${GREEN})`; ctx.fillRect(bx, by, 2, 36);
      text(lines[0], bx + 8, by + 14, 0.9);
      text(lines[1], bx + 8, by + 27, 0.7);
      bracket(x, y, 24, INK, 0.8);
    } else if (hoverField) {
      const f = lay.field, { x, y } = hoverField;
      const px = f.x + (x + 1) / 2 * f.s, py = f.y + (y + 1) / 2 * f.s;
      ctx.globalAlpha = 0.3; ctx.strokeStyle = `rgb(${INK})`; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(f.x, py + 0.5); ctx.lineTo(f.x + f.s, py + 0.5); ctx.moveTo(px + 0.5, f.y); ctx.lineTo(px + 0.5, f.y + f.s); ctx.stroke();
      const p = forward(x, y)[L][0];
      const label = `p ${p.toFixed(2)} · click to add counterexample`;
      ctx.font = FONT;
      const w = ctx.measureText(label).width + 10;
      const bx = clamp(px + 10, 4, Wd - w - 4), by = clamp(py - 22, 4, Hd - 18);
      ctx.globalAlpha = 0.92; ctx.fillStyle = 'rgb(236,246,255)'; ctx.fillRect(bx, by, w, 14);
      text(label, bx + 5, by + 10, 0.8);
    }
  }

  // ---------- DOM sync (copy column) ----------
  const rows = [...document.querySelectorAll('[data-phase]')];
  const segFills = [...document.querySelectorAll('[data-seg-fill]')];
  const metrics = Object.fromEntries([...document.querySelectorAll('[data-metric]')].map(el => [el.dataset.metric, el]));
  let lastPhaseName = '', metricCache = {}, pinnedPhase = -1;
  rows.forEach((r, idx) => {
    r.addEventListener('pointerenter', () => {
      pinnedPhase = idx;
      phase = idx;
      phaseT = PHASES[idx][1] * 0.55;
      if (idx === 3) onUpdate();
      ensureLoop();
    }, { passive: true });
    r.addEventListener('pointerleave', () => {
      pinnedPhase = -1;
    }, { passive: true });
    r.addEventListener('click', () => {
      phase = idx;
      phaseT = 0;
      if (idx === 3) onUpdate();
      ensureLoop();
    });
  });
  function syncDom(ph, pr) {
    if (ph !== lastPhaseName) {
      lastPhaseName = ph;
      rows.forEach(r => r.setAttribute('data-active', String(r.dataset.phase === ph)));
    }
    for (let i = 0; i < segFills.length; i++) {
      const fill = i < phase ? 1 : i === phase ? clamp(pr, 0, 1) : 0;
      segFills[i].style.transform = `scaleX(${fill.toFixed(3)})`;
    }
    if (!sampleA) return;
    const values = {
      forward: `ŷ ${sampleA[L][0].toFixed(3)}`,
      loss: `L ${stats.loss.toFixed(3)}`,
      backward: `‖∇‖ ${stats.norm.toExponential(1)}`,
      update: `step ${epoch}`,
    };
    for (const key in values) {
      if (metrics[key] && metricCache[key] !== values[key]) {
        metricCache[key] = values[key];
        metrics[key].textContent = values[key];
      }
    }
  }

  // ---------- Frame ----------
  function draw(dt) {
    if (!data.length) return;
    const live = !reduced.matches;
    if (live && dt > 0) {
      advance(dt);
      const kf = 1 - Math.exp(-dt * 1.8);
      for (let i = 0; i < fieldShown.length; i++) fieldShown[i] += (fieldTarget[i] - fieldShown[i]) * kf;
      const kw = 1 - Math.exp(-dt * 1.6);
      for (let l = 0; l < L; l++) for (let j = 0; j < SIZES[l + 1]; j++) for (let i = 0; i < SIZES[l]; i++) {
        dispW[l][j][i] += (W[l][j][i] - dispW[l][j][i]) * kw;
      }
      pointsAlpha = Math.min(1, pointsAlpha + dt * 1.8);
      for (const p of data) if (p.fresh > 0) p.fresh = Math.max(0, p.fresh - dt * 0.6);
    }
    const ph = PHASES[phase][0], pr = live ? phaseT / PHASES[phase][1] : 1;
    ctx.clearRect(0, 0, Wd, Hd);
    ctx.textBaseline = 'alphabetic';
    drawHUD(ph, pr);
    drawField(live);
    drawConnectors(ph, pr);
    drawEdges(ph, pr);
    if (live) drawPulses(ph, pr);
    drawNodes(ph, pr);
    drawLossNode(ph, pr);
    drawCurve();
    drawTooltip();
    ctx.globalAlpha = 1;
    syncDom(ph, pr);
  }

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

  // ---------- Input ----------
  function toLocal(e) { return [e.clientX - rect.left, e.clientY - rect.top]; }
  function fieldCoord(x, y) {
    const f = lay.field;
    if (x < f.x || x > f.x + f.s || y < f.y || y > f.y + f.s) return null;
    return { x: clamp((x - f.x) / f.s * 2 - 1, -0.96, 0.96), y: clamp((y - f.y) / f.s * 2 - 1, -0.96, 0.96) };
  }
  stage.addEventListener('pointermove', e => {
    const [x, y] = toLocal(e);
    hoverField = fieldCoord(x, y);
    hoverNode = null;
    if (!hoverField) {
      let best = 16;
      lay.nodes.forEach((layer, l) => layer.forEach(([nx, ny], i) => {
        const d = Math.hypot(nx - x, ny - y);
        if (d < best) { best = d; hoverNode = { l, i }; }
      }));
    }
    stage.style.cursor = hoverField ? 'crosshair' : hoverNode ? 'help' : 'default';
    if (reduced.matches) draw(0);
  }, { passive: true });
  stage.addEventListener('pointerleave', () => {
    hoverField = null; hoverNode = null; stage.style.cursor = 'default';
    if (reduced.matches) draw(0);
  }, { passive: true });
  stage.addEventListener('click', e => {
    rect = stage.getBoundingClientRect();
    const [x, y] = toLocal(e), fc = fieldCoord(x, y);
    if (!fc) return;
    inject(fc.x, fc.y);
    if (reduced.matches) {
      for (let k = 0; k < 200; k++) trainStep();
      const s = evaluate(); stats = { loss: s.loss, acc: s.acc, norm: 0 };
      computeField(); fieldShown.set(fieldTarget); dispW = cloneW(W); setSample(data.length - 1);
      draw(0);
    }
  });

  // ---------- Lifecycle ----------
  new IntersectionObserver(entries => {
    visible = entries[0] ? entries[0].isIntersecting : true;
    if (visible) { rect = stage.getBoundingClientRect(); ensureLoop(); }
    else if (raf) { cancelAnimationFrame(raf); raf = 0; last = 0; }
  }, { threshold: 0.02 }).observe(stage);
  window.addEventListener('scroll', () => { rect = stage.getBoundingClientRect(); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; last = 0; } else ensureLoop();
  });
  function applyReducedState() {
    if (!reduced.matches) return;
    for (let k = 0; k < 400; k++) { trainStep(); epoch++; history.push(evaluate().loss); }
    const s = evaluate(); stats = { loss: s.loss, acc: s.acc, norm: 0 };
    computeField(); fieldShown.set(fieldTarget); dispW = cloneW(W);
    phase = 3; phaseT = 0; pointsAlpha = 1; pickSample();
  }
  reduced.addEventListener('change', () => {
    if (reduced.matches) { if (raf) cancelAnimationFrame(raf); raf = 0; applyReducedState(); draw(0); }
    else ensureLoop();
  });

  reset(false);
  applyReducedState();
  new ResizeObserver(resize).observe(stage);
  resize();
  ensureLoop();
  document.fonts && document.fonts.ready.then(() => draw(0));
})();
