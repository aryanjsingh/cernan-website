/* A small tree-shaped neural network, animated inside the volumetric structure. */
(() => {
  const figure = document.getElementById('neural-branch');
  const svg = figure?.querySelector('svg');
  if (!svg) return;
  const volumeContainer = document.getElementById('branch-volume');
  let volumeRenderer;
  if (volumeContainer && window.BranchVolume) {
    try {
      volumeRenderer = window.BranchVolume.mount(volumeContainer, svg, {
        onError: () => figure.classList.remove('volume-ready'),
        onRestore: () => figure.classList.toggle('volume-ready', volumeContainer.dataset.volumeStatus === 'ready')
      });
      if (volumeContainer.dataset.volumeStatus === 'ready') figure.classList.add('volume-ready');
      if (volumeRenderer.usesNativeSignals) figure.classList.add('native-signals');
    } catch (error) {
      volumeContainer.dataset.volumeStatus = 'fallback';
      console.warn('Showing the static branch fallback:', error.message);
    }
  }
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const button = document.getElementById('branch-pause');
  const phaseName = document.getElementById('branch-phase');
  const description = document.getElementById('branch-description');
  const lossLabel = document.getElementById('branch-loss');
  const steps = [...document.querySelectorAll('.branch-step')];
  const NS = 'http://www.w3.org/2000/svg';
  const flow = document.createElementNS(NS, 'g');
  flow.id = 'branch-flow';
  flow.setAttribute('fill', 'none');
  flow.setAttribute('stroke-linecap', 'round');
  flow.setAttribute('pointer-events', 'none');
  flow.setAttribute('clip-path', 'url(#branch-clip)');
  svg.append(flow);

  const fibers = [...svg.querySelectorAll('.signal-fiber')];
  const edges = [...svg.querySelectorAll('.signal-path')].map((path, index) => {
    const pulse = document.createElementNS(NS, 'g');
    pulse.setAttribute('class', 'branch-pulse');
    pulse.style.opacity = '0';
    const fallbackStrands = fibers.filter(fiber => fiber.dataset.edge === path.id);
    const strands = volumeRenderer?.signalFibers?.[path.id]
      ?? (fallbackStrands.length ? fallbackStrands : [path]).map(strand => strand.getAttribute('d'));
    strands.forEach((d, i, all) => {
      const line = document.createElementNS(NS, 'path');
      line.setAttribute('d', d);
      line.setAttribute('pathLength', '1000');
      line.setAttribute('stroke-width', all.length === 1 ? '1.05' : String(.65 + (i % 3) * .25));
      line.setAttribute('opacity', all.length === 1 ? '.7' : String(.32 + (i % 3) * .18));
      pulse.append(line);
    });
    flow.append(pulse);
    const length = path.getTotalLength();
    return { id: path.id, parentId: path.dataset.parent, path, pulse, length,
      children: [], distance: 0, reverseDistance: 0,
      weight: .88 + (index * .137 % .22), value: 0, delta: 0, gradient: 0,
      target: .34 + (index * .079 % .36) };
  });
  const byId = new Map(edges.map(edge => [edge.id, edge]));
  edges.forEach(edge => {
    edge.parent = byId.get(edge.parentId);
    edge.parent?.children.push(edge);
  });
  const roots = edges.filter(edge => !edge.parent);
  const ordered = [];
  function visit(edge, distance) {
    edge.distance = distance;
    ordered.push(edge);
    edge.children.forEach(child => visit(child, distance + edge.length));
    edge.reverseDistance = Math.max(0, ...edge.children.map(child => child.reverseDistance + child.length));
  }
  roots.forEach(root => visit(root, 0));
  const tips = ordered.filter(edge => !edge.children.length);
  const span = Math.max(...ordered.map(edge => edge.distance + edge.length));
  const tipNodes = [...svg.querySelectorAll('.signal-tip')];
  let loss = 0;
  const signalStrengths = Object.create(null);
  function predict() {
    ordered.forEach(edge => { edge.value = Math.tanh((edge.parent?.value ?? .82) * edge.weight); });
    loss = tips.reduce((sum, edge) => sum + .5 * (edge.value - edge.target) ** 2, 0) / tips.length;
    lossLabel.value = loss.toFixed(3);
    lossLabel.textContent = loss.toFixed(3);
    figure.dataset.loss = loss.toFixed(6);
  }
  function differentiate() {
    [...ordered].reverse().forEach(edge => {
      const error = edge.children.length
        ? edge.children.reduce((sum, child) => sum + child.delta * child.weight, 0)
        : (edge.value - edge.target) / tips.length;
      edge.delta = error * (1 - edge.value ** 2);
      edge.gradient = (edge.parent?.value ?? .82) * edge.delta;
    });
    const maxGradient = Math.max(.0001, ...edges.map(edge => Math.abs(edge.gradient)));
    edges.forEach(edge => { signalStrengths[edge.id] = .35 + .65 * Math.sqrt(Math.abs(edge.gradient) / maxGradient); });
  }
  function learn() {
    ordered.forEach(edge => { edge.weight -= .7 * edge.gradient; });
  }
  predict();
  differentiate();

  const phases = [
    { key: 'forward', label: 'Forward pass', detail: 'Input → prediction', duration: 5200, step: 0 },
    { key: 'error', label: 'Measure error', detail: 'Prediction → error', duration: 1300, step: 1 },
    { key: 'backward', label: 'Backpropagation', detail: 'Error → gradient', duration: 5600, step: 2 },
    { key: 'update', label: 'Adjust weights', detail: 'Gradient → adjustment', duration: 1800, step: 2 },
    { key: 'rest', label: 'Backpropagation', detail: 'Signal out. Error back.', duration: 1800, step: -1 }
  ];
  const cycleDuration = phases.reduce((sum, phase) => sum + phase.duration, 0);
  let elapsed = 0, lastTime = 0, frameId = 0, current = '', cycle = 0, learnedCycle = -1;
  let userPaused = false;
  function clearSignals() {
    volumeRenderer?.setSignal?.({ phase: 'still', travel: 0, trail: 0, strengths: signalStrengths });
    edges.forEach(edge => { edge.pulse.style.opacity = '0'; });
    tipNodes.forEach(node => { node.style.removeProperty('fill'); node.style.removeProperty('opacity'); });
  }
  function paint() {
    let offset = elapsed % cycleDuration;
    let phase = phases[0];
    for (const candidate of phases) {
      phase = candidate;
      if (offset < phase.duration) break;
      offset -= phase.duration;
    }
    const progress = offset / phase.duration;
    if (phase.key !== current) {
      current = phase.key;
      figure.dataset.phase = current;
      phaseName.textContent = phase.label;
      description.textContent = phase.detail;
      steps.forEach((step, index) => step.classList.toggle('active', index === phase.step));
      if (current === 'error') differentiate();
      if (current === 'update' && learnedCycle !== cycle) { learn(); learnedCycle = cycle; }
      clearSignals();
    }
    const trail = span * .18;
    const travel = progress * (span + trail * 1.2);
    volumeRenderer?.setSignal?.({ phase: current, travel, trail, strengths: signalStrengths });
    // WebGL channels share the structure's depth buffer. SVG remains the fallback.
    if (volumeRenderer?.usesNativeSignals && figure.classList.contains('volume-ready')) return;
    edges.forEach(edge => {
      const backward = current === 'backward';
      if (current !== 'forward' && !backward) {
        edge.pulse.style.opacity = '0';
        return;
      }
      const local = backward ? edge.length - (travel - edge.reverseDistance) : travel - edge.distance;
      const start = backward ? local : local - trail;
      const visible = start < edge.length && start + trail > 0;
      const strength = backward ? signalStrengths[edge.id] : 1;
      const entry = Math.min(1, Math.max(0, (start + trail) / Math.min(trail, edge.length * .5)));
      const leave = Math.min(1, Math.max(0, (edge.length - start) / Math.min(trail, edge.length * .5)));
      edge.pulse.style.opacity = visible ? String(strength * entry * leave) : '0';
      edge.pulse.style.stroke = backward ? '#ddc3a1' : '#d0eced';
      edge.pulse.style.strokeDasharray = `${trail / edge.length * 1000} ${(edge.length + trail * 3) / edge.length * 1000}`;
      edge.pulse.style.strokeDashoffset = String(-start / edge.length * 1000);
    });
    tipNodes.forEach(node => {
      const edge = byId.get(node.dataset.edge);
      if (!edge) return;
      if (current === 'error') {
        node.style.fill = '#ddc3a1';
        node.style.opacity = String(.18 + Math.sin(progress * Math.PI) * .32);
      } else if (current === 'forward') {
        const passed = progress * (span + trail * 1.2) - edge.distance - edge.length;
        node.style.fill = '#d0eced';
        node.style.opacity = passed > 0 && passed < trail * 1.5 ? '.55' : '.12';
      } else {
        node.style.opacity = '.16';
      }
    });
  }
  function tick(time) {
    if (lastTime) elapsed += Math.min(time - lastTime, 80);
    lastTime = time;
    const nextCycle = Math.floor(elapsed / cycleDuration);
    if (nextCycle !== cycle) {
      cycle = nextCycle;
      figure.dataset.cycle = String(cycle);
      predict();
    }
    paint();
    frameId = requestAnimationFrame(tick);
  }
  function syncPlayback() {
    cancelAnimationFrame(frameId);
    lastTime = 0;
    const paused = userPaused || motion.matches;
    button.textContent = paused ? 'Play' : 'Pause';
    button.setAttribute('aria-label', paused ? 'Play backpropagation animation' : 'Pause backpropagation animation');
    button.setAttribute('aria-pressed', String(paused));
    figure.dataset.paused = String(paused);
    if (motion.matches) {
      clearSignals();
      phaseName.textContent = 'Backpropagation';
      description.textContent = 'Signal out. Error back. Connections adapt.';
      steps.forEach(step => step.classList.remove('active'));
    } else if (!paused && !document.hidden) {
      current = '';
      frameId = requestAnimationFrame(tick);
    }
  }
  button.hidden = false;
  button.addEventListener('click', () => {
    if (motion.matches) return;
    userPaused = !userPaused;
    syncPlayback();
  });
  function motionChanged() {
    button.hidden = motion.matches;
    syncPlayback();
  }
  motion.addEventListener('change', motionChanged);
  document.addEventListener('visibilitychange', syncPlayback);
  motionChanged();
})();
