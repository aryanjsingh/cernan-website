/* Shared page behaviour: nav state, reveals, map focus, operations tabs, contact form. */
(() => {
  const body = document.body, nav = document.querySelector('.nav');
  // Smooth, weighted scrolling. Off for reduced motion, where native scrolling is kinder.
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  if (window.Lenis && !calm.matches) {
    new Lenis({ autoRaf: true, lerp: .085, wheelMultiplier: .9, anchors: { offset: -76, duration: 1.4, easing: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) } });
  }

  // Siblings that reveal together arrive one after another rather than all at once.
  document.querySelectorAll('.ledger li, .band-inner > .reveal, .section-head .reveal').forEach(node => {
    const index = [...node.parentElement.children].indexOf(node);
    node.style.setProperty('--d', `${Math.min(index, 5) * 70}ms`);
  });

  const toggle = document.querySelector('.menu-toggle');

  const links = [...document.querySelectorAll('.nav-links a')];

  function onScroll() {
    body.classList.toggle('scrolled', scrollY > 10);
    // Mark the section currently under the top third of the viewport.
    let current = '';
    for (const link of links) { const target = document.querySelector(link.hash); if (target && target.getBoundingClientRect().top < innerHeight * .4) current = link.hash; }
    for (const link of links) { if (link.hash === current) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current'); }
  }
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); onScroll();

  if (toggle) {
    links.forEach(link => link.addEventListener('click', () => {
      body.classList.remove('menu-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = 'Menu';
    }));
    toggle.addEventListener('click', () => {
      const open = body.classList.toggle('menu-open');
      toggle.setAttribute('aria-expanded', String(open)); toggle.textContent = open ? 'Close' : 'Menu';
    });
  }

  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }), { threshold: .2 });
  document.querySelectorAll('.reveal, .ledger li').forEach(element => observer.observe(element));

  // Operations tabs swap the feature list and the console view, and replay the console.
  const tabs = [...document.querySelectorAll('[data-ops]')];
  const views = [...document.querySelectorAll('[data-ops-view]')];
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const ease = t => 1 - Math.pow(1 - t, 3);
  function play(view) {
    view.classList.remove('is-playing'); void view.offsetWidth; view.classList.add('is-playing');
    view.querySelectorAll('[data-count]').forEach(node => {
      const target = +node.dataset.count;
      if (still.matches) { node.textContent = target; return; }
      const start = performance.now();
      const step = now => { const t = Math.min(1, (now - start) / 1200); node.textContent = Math.round(target * ease(t)); if (t < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }
  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(other => other.setAttribute('aria-selected', String(other === tab)));
    document.querySelectorAll('[data-ops-panel]').forEach(panel => { panel.hidden = panel.dataset.opsPanel !== tab.dataset.ops; });
    views.forEach(view => { view.hidden = view.dataset.opsView !== tab.dataset.ops; if (!view.hidden) play(view); });
  }));
  const consoleBox = document.querySelector('.console');
  if (consoleBox) {
    new IntersectionObserver((entries, watcher) => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      play(views.find(view => !view.hidden)); watcher.disconnect();
    }), { threshold: .35 }).observe(consoleBox);
    // The latency reading keeps moving a little, like a live metric.
    const latency = document.querySelector('[data-ops-view="1"] [data-count]');
    setInterval(() => {
      if (still.matches || document.hidden || !latency || latency.closest('[hidden]') || !latency.closest('.is-playing')) return;
      latency.textContent = 178 + Math.round(Math.random() * 14);
    }, 1800);
  }

  // The form has no backend yet: validate, then say so rather than pretend to send.
  const form = document.getElementById('contact-form');
  if (form) {
    const status = document.getElementById('form-status');
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.checkValidity()) { status.textContent = 'Please add your name, a valid email and a message.'; form.querySelector(':invalid').focus(); return; }
      status.textContent = 'This form is not connected to an inbox yet.';
    });
  }
})();
