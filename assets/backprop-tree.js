/*
  Backpropagation Tree — p5.js (instance mode)

  Nothing about the shape is hand-placed. The tree is grown with space
  colonization: a cloud of attraction points (thinned by 3D noise) pulls
  new branches toward it, branches stop where they reach light, and every
  branch's thickness comes from how much tree it carries (pipe model).
  Depth comes from the same process seen through a slow 3D rotation and fog.

  The tree is the network:
    trunk            = input
    branches         = weights, thicker where more signal flows
    branch tips      = outputs (predictions)

  Training loop:
    FORWARD   a front of light rises from the trunk to every tip
    LOSS      tips light up by how wrong they are
    BACKWARD  error flows back down, brighter on branches that caused more of it
    UPDATE    weights adjust, error shrinks, and the tree grows — learning is growth
*/
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR = { grow: 5.5, forward: 2.2, loss: 1.0, backward: 2.4, update: 1.4 };
  const SIG_FWD = '255,255,255';
  const SIG_ERR = '255,122,47';           // orange

  const hud = {
    root: document.getElementById('bp-hud'),
    epoch: document.getElementById('bp-epoch'),
    loss: document.getElementById('bp-loss'),
    spark: document.getElementById('bp-spark'),
    steps: [...document.querySelectorAll('#bp-hud [data-step]')],
  };

  new p5((p) => {
    let W, H, ctx;
    let nodes = [], tips = [], attractors = [], grid = new Map();
    let step, influence, kill, trunkR;
    let t = 0, phase = 'grow', phaseT = 0, epoch = 0, lossHist = [], lossStart = 1;
    let rotY = 0, mouseRot = 0, maxDist = 1, converged = 0;
    let glowOrange, glowWhite;
    const proj = { c: 1, s: 0, fov: 1, cx: 0, cy: 0 };

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const norm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };

    // ---------- growth ----------
    function cellKey(x, y, z) { return `${Math.floor(x / influence)},${Math.floor(y / influence)},${Math.floor(z / influence)}`; }
    function addNode(parent, x, y, z) {
      const n = { x, y, z, parent, children: [], r: 0, g: 0, dist: 0, err: 0, grad: 0, w: 1, wv: 1, seed: Math.random() * 6.28 };
      if (parent) { parent.children.push(n); n.dist = parent.dist + Math.hypot(x - parent.x, y - parent.y, z - parent.z); n.err = parent.err; }
      else n.g = 1;
      nodes.push(n);
      const k = cellKey(x, y, z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(n);
      return n;
    }
    function seedTree() {
      nodes = []; grid = new Map(); attractors = [];
      step = H * 0.009; influence = H * 0.13; kill = H * 0.013; trunkR = H * 0.014;
      p.noiseSeed(Math.random() * 1e6);
      // crown: an ellipsoid of points, kept only where 3D noise is dense — clumps emerge
      const cy = -H * 0.58, rx = H * 0.42, ry = H * 0.31, rz = H * 0.34;
      let tries = 0;
      while (attractors.length < 2600 && tries++ < 60000) {
        const x = (Math.random() * 2 - 1) * rx, y = (Math.random() * 2 - 1) * ry, z = (Math.random() * 2 - 1) * rz;
        const e = (x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2;
        if (e > 1) continue;
        const d = p.noise(x * 0.006 + 10, y * 0.006 + 10, z * 0.006 + 10);
        if (d < 0.42 + e * 0.12) continue;
        attractors.push([x, cy + y, z]);
      }
      const root = addNode(null, 0, 0, 0);
      let n = root;
      // trunk rises until it feels the crown, leaning with a little noise
      while (n.y > cy + ry * 0.9) {
        const lean = (p.noise(n.y * 0.01) - 0.5) * 0.5;
        const d = norm(lean, -1, (p.noise(n.y * 0.01 + 50) - 0.5) * 0.5);
        n = addNode(n, n.x + d[0] * step, n.y + d[1] * step, n.z + d[2] * step);
      }
      maxDist = n.dist;
    }
    function growStep() {
      if (!attractors.length) return 0;
      const pull = new Map();
      const keep = [];
      for (const a of attractors) {
        const cx = Math.floor(a[0] / influence), cy = Math.floor(a[1] / influence), cz = Math.floor(a[2] / influence);
        let best = null, bd = influence;
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
          const cell = grid.get(`${cx + i},${cy + j},${cz + k}`); if (!cell) continue;
          for (const n of cell) { const d = Math.hypot(a[0] - n.x, a[1] - n.y, a[2] - n.z); if (d < bd) { bd = d; best = n; } }
        }
        if (best && bd < kill) continue;          // reached: attractor consumed
        keep.push(a);
        if (best) {
          const v = pull.get(best) || [0, 0, 0, 0];
          const dn = norm(a[0] - best.x, a[1] - best.y, a[2] - best.z);
          v[0] += dn[0]; v[1] += dn[1]; v[2] += dn[2]; v[3]++; pull.set(best, v);
        }
      }
      attractors = keep;
      let added = 0;
      for (const [n, v] of pull) {
        const d = norm(v[0] / v[3] + (Math.random() - 0.5) * 0.12, v[1] / v[3] - 0.12 + (Math.random() - 0.5) * 0.12, v[2] / v[3] + (Math.random() - 0.5) * 0.12);
        const c = addNode(n, n.x + d[0] * step, n.y + d[1] * step, n.z + d[2] * step);
        if (c.dist > maxDist) maxDist = c.dist;
        added++;
      }
      return added;
    }
    // pipe model: a branch carries the cross-section of everything above it
    function computeRadii() {
      tips = [];
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (!n.children.length) { n.r = 1; n.leafCount = 1; tips.push(n); continue; }
        let s = 0, lc = 0; for (const c of n.children) { s += Math.pow(c.r, 2.5); lc += c.leafCount; }
        n.r = Math.pow(s, 1 / 2.5); n.leafCount = lc;
      }
      const scale = trunkR / nodes[0].r;
      for (const n of nodes) n.rad = Math.max(0.35, n.r * scale);
    }
    function computeGrads() {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (!n.children.length) { n.gsum = n.err; n.gcnt = 1; }
        else { n.gsum = 0; n.gcnt = 0; for (const c of n.children) { n.gsum += c.gsum; n.gcnt += c.gcnt; } }
        n.grad = n.gsum / n.gcnt;
      }
    }
    const meanLoss = () => tips.reduce((s, n) => s + n.err, 0) / Math.max(1, tips.length);

    // ---------- projection ----------
    function project(n, sway) {
      const h = clamp(-n.y / H, 0, 1);
      const wx = n.x + sway * h * h * H * 0.03 * Math.sin(n.seed * 0.2 + t * 0.6);
      const x = wx * proj.c + n.z * proj.s, z = -wx * proj.s + n.z * proj.c, f = proj.fov / (proj.fov + z);
      n.sx = proj.cx + x * f; n.sy = proj.cy + n.y * f; n.sz = z; n.sf = f;
    }
    const fog = (z) => clamp(0.92 - z / (H * 0.9), 0.28, 1);

    // ---------- drawing ----------
    function sprite(rgb) {
      const g = document.createElement('canvas'); g.width = g.height = 64;
      const c = g.getContext('2d'), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.3, `rgba(${rgb},.45)`); gr.addColorStop(1, `rgba(${rgb},0)`);
      c.fillStyle = gr; c.fillRect(0, 0, 64, 64); return g;
    }
    // batch segments into buckets (width x fog) so thousands of strokes stay cheap
    function strokeBuckets(list, style, widthOf, alphaOf, mode) {
      const buckets = new Map();
      for (const n of list) {
        const a = alphaOf(n); if (a <= 0.02) continue;
        const w = widthOf(n);
        const key = `${Math.round(w * 2)}|${Math.round(a * 10)}`;
        let b = buckets.get(key); if (!b) { b = { w: Math.round(w * 2) / 2, a: Math.round(a * 10) / 10, path: new Path2D() }; buckets.set(key, b); }
        const par = n.parent, gx = par.sx + (n.sx - par.sx) * n.g, gy = par.sy + (n.sy - par.sy) * n.g;
        b.path.moveTo(par.sx + (mode || 0), par.sy); b.path.lineTo(gx + (mode || 0), gy);
      }
      ctx.strokeStyle = style;
      for (const b of buckets.values()) { ctx.globalAlpha = b.a; ctx.lineWidth = Math.max(0.35, b.w); ctx.stroke(b.path); }
    }

    function drawTree(segs) {
      // silhouette
      strokeBuckets(segs, 'rgb(12,28,46)', (n) => n.rad * 2 * n.sf * (0.85 + 0.15 * n.wv), (n) => fog(n.sz) * 0.95);
      // sky light catching the left edge of thicker limbs — gives roundness
      strokeBuckets(segs.filter((n) => n.rad > 1.6), 'rgb(150,200,240)', (n) => n.rad * 0.5 * n.sf, (n) => fog(n.sz) * 0.35, -0.0);
      // fine fanned twigs continuing each tip's direction — texture, not flowers
      ctx.strokeStyle = 'rgb(14,34,54)'; ctx.lineWidth = 0.5;
      const twig = new Path2D();
      for (const n of tips) {
        if (n.g < 1 || !n.parent) continue;
        const base = Math.atan2(n.sy - n.parent.sy, n.sx - n.parent.sx);
        for (let i = 0; i < 4; i++) {
          const a = base + (i - 1.5) * 0.45 + Math.sin(t * 1.1 + n.seed + i) * 0.12;
          const l = (5 + ((i * 7 + n.seed * 13) % 7)) * n.sf;
          twig.moveTo(n.sx, n.sy); twig.lineTo(n.sx + Math.cos(a) * l, n.sy + Math.sin(a) * l);
        }
      }
      ctx.globalAlpha = 0.32; ctx.stroke(twig);
    }

    function drawSignals(segs) {
      ctx.lineCap = 'butt';
      if (phase === 'forward') {
        const f = (phaseT / DUR.forward) * (maxDist * 1.12), band = maxDist * 0.14;
        strokeBuckets(segs, `rgb(${SIG_FWD})`, (n) => Math.max(1, n.rad * 1.1 * n.sf),
          (n) => { const d = f - n.dist; return d < 0 ? 0 : Math.exp(-d / band) * 0.95 * fog(n.sz); });
        ctx.globalCompositeOperation = 'lighter';
        for (const n of tips) { const d = f - n.dist; if (d > 0 && d < band) { const r = 6 * n.sf; ctx.globalAlpha = 0.6 * (1 - d / band); ctx.drawImage(glowWhite, n.sx - r, n.sy - r, r * 2, r * 2); } }
        ctx.globalCompositeOperation = 'source-over';
        const base = nodes[0], k = clamp(1 - phaseT / 0.8, 0, 1), r = 26;
        ctx.globalAlpha = k * 0.9; ctx.drawImage(glowWhite, base.sx - r, base.sy - r, r * 2, r * 2);
      }
      if (phase === 'loss' || phase === 'backward') {
        const k = phase === 'loss' ? clamp(phaseT / (DUR.loss * 0.6), 0, 1) : 1 - clamp(phaseT / DUR.backward, 0, 1) * 0.7;
        for (const n of tips) {
          if (n.err < 0.03 || n.g < 1) continue;
          const r = (3 + n.err * 9) * n.sf;
          ctx.globalAlpha = k * n.err * fog(n.sz); ctx.drawImage(glowOrange, n.sx - r, n.sy - r, r * 2, r * 2);
        }
      }
      if (phase === 'backward') {
        const b = maxDist * 1.08 - (phaseT / DUR.backward) * (maxDist * 1.2), band = maxDist * 0.16;
        strokeBuckets(segs, `rgb(${SIG_ERR})`, (n) => Math.max(1, n.rad * 1.2 * n.sf) * (0.6 + n.grad),
          (n) => { const d = n.dist - b; return d < 0 ? 0 : Math.exp(-d / band) * clamp(n.grad * 1.6, 0.12, 1) * fog(n.sz); });
      }
      if (phase === 'update') {
        const k = Math.sin(clamp(phaseT / DUR.update, 0, 1) * Math.PI);
        strokeBuckets(segs, `rgb(${SIG_FWD})`, (n) => Math.max(0.8, n.rad * 0.8 * n.sf), (n) => k * 0.35 * clamp(n.grad * 2, 0.15, 1) * fog(n.sz));
      }
      if (converged > 0) {
        ctx.globalCompositeOperation = 'lighter';
        for (const n of tips) { const r = 4 * n.sf; ctx.globalAlpha = 0.35 * Math.sin(converged * Math.PI); ctx.drawImage(glowWhite, n.sx - r, n.sy - r, r * 2, r * 2); }
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    function drawLabels() {
      if (!nodes.length) return;
      ctx.globalAlpha = 0.6; ctx.fillStyle = 'rgb(11,26,43)';
      ctx.font = '500 10.5px "JetBrains Mono", monospace';
      let top = tips[0] || nodes[0]; for (const n of tips) if (n.sy < top.sy) top = n;
      if (phase !== 'grow') { ctx.textAlign = 'center'; ctx.fillText('ŷ  OUTPUT', top.sx, top.sy - 18); }
      ctx.textAlign = 'left'; ctx.fillText('x  INPUT', nodes[0].sx + 22, H - 16);
    }

    // ---------- training loop ----------
    function advance(dt) {
      if (converged > 0) {
        converged -= dt / 2.8;
        if (converged <= 0) {
          converged = 0;
          for (const n of tips) n.err = 0.4 + Math.random() * 0.6;
          lossStart = meanLoss(); lossHist = []; epoch = 1; phase = 'forward'; phaseT = 0;
        }
        return;
      }
      phaseT += dt;
      if (phase === 'grow') {
        for (let i = 0; i < 6; i++) growStep();
        computeRadii();
        if (phaseT > DUR.grow) {
          for (const n of tips) n.err = 0.4 + Math.random() * 0.6;
          lossStart = meanLoss(); epoch = 1; phase = 'forward'; phaseT = 0;
        }
        return;
      }
      if (phase === 'update' && phaseT < DUR.update * 0.8) {      // learning is growth
        if (growStep()) { computeRadii(); for (const n of tips) if (n.err === undefined) n.err = 0.2; }
      }
      if (phaseT < DUR[phase]) return;
      phaseT = 0;
      if (phase === 'forward') phase = 'loss';
      else if (phase === 'loss') { computeGrads(); phase = 'backward'; }
      else if (phase === 'backward') {
        for (const n of nodes) n.w = clamp(n.w + (Math.random() - 0.4) * 0.6 * n.grad, 0.8, 1.3);
        for (const n of tips) n.err = clamp(n.err * (0.6 + Math.random() * 0.2) + (Math.random() - 0.5) * 0.02, 0, 1);
        lossHist.push(meanLoss());
        phase = 'update';
      } else {
        epoch++;
        phase = 'forward';
        if (meanLoss() < 0.05) converged = 1;
      }
    }

    function updateHud() {
      if (!hud.root) return;
      // keep the readout beside the trunk base, left of it
      const base = nodes[0];
      const rect = p.canvas.getBoundingClientRect();
      hud.root.style.left = `${Math.max(16, rect.left + base.sx - hud.root.offsetWidth - 56)}px`;
      hud.epoch.textContent = phase === 'grow' ? '—' : String(epoch).padStart(3, '0');
      const L = lossHist.length ? lossHist[lossHist.length - 1] : (phase === 'grow' ? null : meanLoss());
      hud.loss.textContent = L === null ? '—' : L.toFixed(3);
      const active = converged > 0 ? 'done' : phase;
      for (const s of hud.steps) s.classList.toggle('on', s.dataset.step === active);
      const pts = [lossStart, ...lossHist], n = Math.max(10, pts.length - 1);
      hud.spark.setAttribute('points', phase === 'grow' ? '' : pts.map((v, i) => `${(i / n) * 140},${30 - (v / lossStart) * 26}`).join(' '));
    }

    // ---------- p5 lifecycle ----------
    function setupScene() {
      const el = document.getElementById('tree');
      W = el.clientWidth; H = el.clientHeight;
      proj.cx = W * 0.52; proj.cy = H; proj.fov = H * 1.8;
      seedTree(); computeRadii();
      phase = 'grow'; phaseT = 0; epoch = 0; lossHist = []; converged = 0;
      if (reduce) {                                   // static, fully grown frame
        while (growStep()) {} computeRadii();
        for (const n of nodes) n.g = 1;
        for (const n of tips) n.err = 0.3 + Math.random() * 0.5;
        lossStart = meanLoss(); computeGrads(); epoch = 3; phase = 'backward'; phaseT = DUR.backward * 0.45;
      }
    }
    p.setup = () => {
      const el = document.getElementById('tree');
      p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
      p.createCanvas(el.clientWidth, el.clientHeight).parent(el);
      ctx = p.drawingContext; ctx.lineCap = 'round';
      glowOrange = sprite(SIG_ERR); glowWhite = sprite(SIG_FWD);
      setupScene();
      addEventListener('pointermove', (e) => { mouseRot = (e.clientX / innerWidth - 0.5) * 0.45; });
      if (reduce) p.noLoop();
    };
    p.windowResized = () => { const el = document.getElementById('tree'); p.resizeCanvas(el.clientWidth, el.clientHeight); ctx.lineCap = 'round'; setupScene(); };
    p.draw = () => {
      const dt = Math.min(0.05, (p.deltaTime || 16) / 1000);
      if (!reduce) { t += dt; advance(dt); }
      rotY += (Math.sin(t * 0.09) * 0.7 + mouseRot - rotY) * 0.03;
      proj.c = Math.cos(rotY); proj.s = Math.sin(rotY);
      for (const n of nodes) {
        if (n.g < 1) n.g = Math.min(1, n.g + dt * 5);
        n.wv += (n.w - n.wv) * 0.05;
        project(n, 1);
      }
      const segs = nodes.slice(1).sort((a, b) => b.sz - a.sz);

      p.clear(); ctx.lineCap = 'round';
      drawTree(segs);
      drawSignals(segs);
      drawLabels();
      ctx.globalAlpha = 1;
      updateHud();
    };
  });
})();
