// Soft drifting cloud field with sun glow
(() => {
  const c = document.getElementById('clouds');
  if (!c) return;
  const x = c.getContext('2d');
  if (!x) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let W, H, dpr, raf = 0, clouds = [], visible = true;

  function puff(cx, cy, r, a) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.6, `rgba(255,255,255,${a * 0.45})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  }

  function make() {
    clouds = [];
    for (let i = 0; i < 9; i++) {
      const depth = Math.random();
      const blobs = [];
      const n = 6 + (Math.random() * 6 | 0);
      for (let j = 0; j < n; j++) blobs.push({ ox: (Math.random() - .5) * 420, oy: (Math.random() - .5) * 70 - j * 2, r: 60 + Math.random() * 120 });
      clouds.push({ x: Math.random() * W * 1.4 - W * 0.2, y: H * (0.45 + depth * 0.5), s: 0.6 + depth * 0.9, v: 0.06 + depth * 0.22, a: 0.18 + depth * 0.32, blobs });
    }
    clouds.sort((a, b) => a.s - b.s);
  }

  function draw(advance) {
    x.clearRect(0, 0, W, H);
    for (const cl of clouds) {
      for (const b of cl.blobs) puff(cl.x + b.ox * cl.s, cl.y + b.oy * cl.s, b.r * cl.s, cl.a);
      if (advance) {
        cl.x += cl.v;
        if (cl.x - 400 * cl.s > W) cl.x = -400 * cl.s;
      }
    }
    const g = x.createRadialGradient(W * 0.82, H * 0.12, 0, W * 0.82, H * 0.12, W * 0.35);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }

  function frame() {
    draw(!motion.matches);
    if (!motion.matches && visible && !document.hidden) raf = requestAnimationFrame(frame);
    else raf = 0;
  }

  function ensure() {
    if (motion.matches) { draw(false); return; }
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = c.clientWidth; H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0); make();
    draw(false);
  }

  new ResizeObserver(size).observe(c);
  new IntersectionObserver((entries) => {
    visible = entries[0] ? entries[0].isIntersecting : true;
    if (visible) ensure();
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }, { threshold: 0.01 }).observe(c);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; }
    else ensure();
  });
  motion.addEventListener('change', () => {
    if (motion.matches && raf) { cancelAnimationFrame(raf); raf = 0; draw(false); }
    else ensure();
  });

  size();
  ensure();
})();
