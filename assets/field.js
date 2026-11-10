/*
 * Cernan field scenes (three.js). Every scene is an illustration driven by
 * scroll progress: a procedural night map, a cell volume, a ribbon system . state = { time, progress, enter, pointer, focus, aim }.
 */
import * as THREE from './vendor/three.module.min.js';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (v, a, b) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const fract = v => v - Math.floor(v);
const random = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453123);
const noise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (i, j) => random(i * 57 + j * 131);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return mix(mix(h(xi, yi), h(xi + 1, yi), u), mix(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
};
const BG = 0x070707, BLUE = 0x2b9be8, RED = 0xff5a3c;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------- shared geometry helpers ---------- */
const curve = (points, samples) => new THREE.CatmullRomCurve3(points.map(p => V3(p[0], 0, p[1])))
  .getPoints(samples).map(v => [v.x, v.z]);
function ribbon(points, width, y = 0) {
  const n = points.length, position = new Float32Array(n * 6), uv = new Float32Array(n * 4), index = [];
  const lengths = [0];
  for (let i = 1; i < n; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const total = lengths[n - 1] || 1;
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
    const t = lengths[i] / total, w = (typeof width === 'function' ? width(t) : width) / 2;
    position.set([points[i][0] + nx * w, y, points[i][1] + nz * w, points[i][0] - nx * w, y, points[i][1] - nz * w], i * 6);
    uv.set([t, 0, t, 1], i * 4);
    if (i < n - 1) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.userData.length = total;
  return geometry;
}
function distance(x, z, points) {
  let best = 1e9;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1));
    best = Math.min(best, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
  }
  return best;
}
const flat = (geometry, material, y = 0) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = y;
  return mesh;
};
const additive = (color, opacity = 1) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
});
function orbit(camera, target, yaw, pitch, dist) {
  const cp = Math.cos(pitch);
  camera.position.set(target.x + Math.sin(yaw) * cp * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * cp * dist);
  camera.lookAt(target);
  camera.updateMatrixWorld(); // labels project against this frame's camera, not the last one
}

/* ---------- Night map: streets, rooftops, rivers, a ring campus ---------- */
const THETA = -.29, COS = Math.cos(THETA), SIN = Math.sin(THETA);
const toWorld = (u, v) => [u * COS - v * SIN, u * SIN + v * COS];
const ARTERIAL_U = [-9.8, -7.5, -5.2, -2.9, -.7, 1.6, 3.9, 6.2, 8.4], ARTERIAL_V = [-8, -6, -3.9, -1.9, .2, 2.2, 4.3, 6.4];
const CAMPUS = toWorld(.45, -.85);

function buildMap(scene) {
  const rivers = [
    curve([[4, -7], [3.6, -5.4], [2.9, -3.6], [2.15, -2.3], [2.9, -.7], [2.55, .6], [1.4, 1.5], [1.15, 3], [.5, 4.6], [.3, 7]], 150),
    curve([[9.5, -3.6], [8, -3], [6.7, -1.9], [6, -.3], [5.2, .8], [4.9, 2.4], [5.4, 4], [5.2, 5.4], [5.6, 7]], 110)
  ];
  const freeway = curve([[-10, 2.3], [-7.5, 1.3], [-5, 1.1], [-2.6, 1.7], [-.4, 2.5], [2.4, 3.6], [5.4, 4.5], [10, 5.4]], 130);
  const junction = freeway[52];
  const lights = [new THREE.AmbientLight(0xffffff, 1.5), new THREE.DirectionalLight(0xffffff, 1.6)];
  lights[1].position.set(-4, 6, 3);
  scene.add(...lights);
  scene.add(flat(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0x090909 }), -.002));

  // Rooftops: a jittered lattice in street coordinates, cleared around roads and water.
  const dummy = new THREE.Object3D(), color = new THREE.Color(), items = [];
  for (let i = -90; i <= 90; i++) for (let j = -80; j <= 80; j++) {
    const u = i * .115, v = j * .125, [x, z] = toWorld(u, v);
    if (Math.abs(x) > 9.4 || Math.abs(z) > 6.8) continue;
    const zone = noise(u * .34 + 9, v * .34 + 4), key = i * 181 + j * 7.3;
    if (zone < .2) continue;
    const big = zone > .72;
    if (big ? (i % 3 !== 0 || j % 4 !== 0) : ((j % 4 + 4) % 4 === 3 || (i % 10 + 10) % 10 === 9 || random(key) < .07)) continue;
    const clear = big ? .2 : .1;
    if (ARTERIAL_U.some(a => Math.abs(u - a) < clear) || ARTERIAL_V.some(a => Math.abs(v - a) < clear)) continue;
    if (Math.hypot(x - CAMPUS[0], z - CAMPUS[1]) < 1.02 || Math.hypot(x - junction[0], z - junction[1]) < .5) continue;
    if (distance(x, z, freeway) < .16 + clear * .5 || rivers.some(r => distance(x, z, r) < .15 + clear * .5)) continue;
    const height = big ? .03 + random(key + 2) * .12 : .012 + random(key + 3) * .022;
    const grey = (big ? .1 : .075) + random(key + 5) * .03;
    items.push({ x, z, sx: big ? .22 + random(key + 1) * .08 : .088, sz: big ? .3 + random(key + 4) * .1 : .1, height, grey });
  }
  const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), items.length);
  items.forEach((item, index) => {
    dummy.position.set(item.x, item.height / 2, item.z); dummy.rotation.y = -THETA;
    dummy.scale.set(item.sx, item.height, item.sz); dummy.updateMatrix();
    roofs.setMatrixAt(index, dummy.matrix); roofs.setColorAt(index, color.setRGB(item.grey, item.grey, item.grey * 1.03));
  });
  scene.add(roofs);

  const road = new THREE.MeshBasicMaterial({ color: 0x343436, side: THREE.DoubleSide });
  const major = new THREE.MeshBasicMaterial({ color: 0x424245, side: THREE.DoubleSide });
  for (const u of ARTERIAL_U) scene.add(new THREE.Mesh(ribbon([toWorld(u, -12), toWorld(u, 12)], .05, .003), road));
  for (const v of ARTERIAL_V) scene.add(new THREE.Mesh(ribbon([toWorld(-12, v), toWorld(12, v)], .05, .003), road));
  for (const side of [-1, 1]) {
    const lane = freeway.map((p, i) => {
      const a = freeway[Math.max(0, i - 1)], b = freeway[Math.min(freeway.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return [p[0] - (b[1] - a[1]) / l * .05 * side, p[1] + (b[0] - a[0]) / l * .05 * side];
    });
    scene.add(new THREE.Mesh(ribbon(lane, .055, .006), major));
  }
  for (const [dx, dz] of [[-.2, -.17], [.2, .17], [-.17, .2], [.17, -.2]]) {
    const loop = flat(new THREE.RingGeometry(.1, .135, 40), major, .006);
    loop.position.set(junction[0] + dx, .006, junction[1] + dz); scene.add(loop);
  }

  // Campus: a ring building around a park.
  const campus = new THREE.Group();
  campus.position.set(CAMPUS[0], 0, CAMPUS[1]);
  campus.add(flat(new THREE.CircleGeometry(.98, 64), new THREE.MeshBasicMaterial({ color: 0x0e0e0e }), .001));
  campus.add(flat(new THREE.RingGeometry(.47, .62, 80), new THREE.MeshBasicMaterial({ color: 0x2c2c2f }), .07));
  campus.add(flat(new THREE.CircleGeometry(.47, 64), new THREE.MeshBasicMaterial({ color: 0x121213 }), .004));
  for (const radius of [.62, .47]) {
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, .07, 80, 1, true), new THREE.MeshBasicMaterial({ color: 0x202022, side: THREE.DoubleSide }));
    wall.position.y = .035; campus.add(wall);
  }
  for (let k = 0; k < 5; k++) {
    const path = flat(new THREE.RingGeometry(.1 + k * .07, .104 + k * .07, 48, 1, k * 1.3, 2.4 + random(k) * 2), new THREE.MeshBasicMaterial({ color: 0x2a2a2d }), .006);
    path.position.x = (random(k + 3) - .5) * .12; campus.add(path);
  }
  scene.add(campus);

  // Rivers carry a slow travelling shimmer.
  const water = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uLength: { value: 1 } }, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime, uLength;
      void main(){ float flow = .5 + .5 * sin(vUv.x * uLength * 9. - uTime * 1.6);
        float edge = smoothstep(0., .22, vUv.y) * smoothstep(1., .78, vUv.y);
        gl_FragColor = vec4(mix(vec3(.05, .34, .56), vec3(.17, .62, .93), edge * (.72 + .28 * flow)), 1.); }`
  });
  const waters = rivers.map((points, index) => {
    const width = t => .075 + .06 * noise(t * 9 + index * 5, 2) + .05 * Math.max(0, Math.sin(t * 17 + index));
    const geometry = ribbon(points, width, .008), material = water.clone();
    material.uniforms.uLength.value = geometry.userData.length;
    scene.add(new THREE.Mesh(geometry, material));
    scene.add(new THREE.Mesh(ribbon(points, .5, .007), additive(BLUE, .07)));
    return material;
  });
  return { rivers, freeway, junction, tick: time => waters.forEach(m => { m.uniforms.uTime.value = time; }) };
}

function pin(scene, position, height = .9, color = BLUE) {
  const group = new THREE.Group();
  group.position.set(position[0], 0, position[1]);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, height, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7 }));
  stem.position.y = height / 2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(.04, 20, 14), new THREE.MeshBasicMaterial({ color }));
  head.position.y = height;
  const rings = [0, 1].map(() => flat(new THREE.RingGeometry(.93, 1, 56), additive(color, .6), .012));
  const dot = flat(new THREE.CircleGeometry(.07, 28), new THREE.MeshBasicMaterial({ color }), .014);
  group.add(stem, head, dot, ...rings); scene.add(group);
  return {
    group, head, dot, rings, top: V3(position[0], height, position[1]),
    pulse(time, reach = .55, strength = 1) {
      rings.forEach((ring, index) => {
        const phase = fract(time * .4 + index * .5);
        ring.scale.setScalar(.08 + phase * reach); ring.material.opacity = (1 - phase) * .7 * strength;
      });
    },
    tint(value) { head.material.color.set(value); dot.material.color.set(value); rings.forEach(r => r.material.color.set(value)); }
  };
}

function map({ scene, camera, mode, label }) {
  scene.fog = new THREE.Fog(BG, 9, 21);
  const world = buildMap(scene), target = V3(.6, 0, .2), view = { yaw: .4, pitch: .62, dist: 12.4 };

  if (mode === 'security') return securityMap({ scene, camera, label, world });

  // Territory: three waypoints, one per practice.
  const sites = [
    { at: CAMPUS, text: '01 · Models' },
    { at: world.rivers[0][44], text: '02 · Security' },
    { at: world.junction, text: '03 · Software' }
  ].map(site => ({ ...site, pin: pin(scene, site.at, .95) }));
  return ({ time, progress, pointer, focus }) => {
    world.tick(time);
    const active = sites[focus], goal = active ? V3(active.at[0], 0, active.at[1]) : V3(.9 + Math.sin(time * .11) * .5, 0, .1);
    target.lerp(goal, .045);
    view.dist += ((active ? 5.6 : 12.6 - progress * 1.8) - view.dist) * .045;
    view.pitch += ((active ? .5 : .66) - view.pitch) * .045;
    view.yaw += ((active ? .2 + focus * .5 : .38 + Math.sin(time * .07) * .22) + pointer[0] * .1 - view.yaw) * .045;
    orbit(camera, target, view.yaw, view.pitch - pointer[1] * .03, view.dist);
    sites.forEach((site, index) => {
      site.pin.pulse(time + index * .4, focus === index ? .9 : .5);
      label(`site${index}`, site.pin.top, site.text, focus === index ? 'on' : '', 1);
    });
  };
}

/* Security: links arc over the city; one node turns, and a dome seals it. */
function securityMap({ scene, camera, label, world }) {
  const core = [.9, -.9];
  const places = [core, [1.9, -2.2], [-1.2, -1.5], [2.7, -.1], [-3.2, -2.7], [-1.5, -3.5], [.5, -3.7], [3.5, -3.3], [4.7, -1.2], [3.9, 1], [1.9, 2.1], [-.7, 1.6], [-2.9, .5], [-3.9, -1]];
  const BAD = 8, GATE = 3;
  const pairs = [[1, 0], [2, 0], [GATE, 0], [BAD, GATE], [4, 2], [5, 2], [6, 1], [7, 1], [9, GATE], [10, GATE], [11, 2], [12, 2], [13, 2], [5, 6], [9, 10], [12, 13], [7, BAD], [4, 13]];
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOffset: { value: 0 }, uFront: { value: 0 }, uAlpha: { value: 1 }, uColor: { value: new THREE.Color(BLUE) }, uHot: { value: new THREE.Color(RED) } },
    vertexShader: 'attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying float vT; uniform float uTime, uOffset, uFront, uAlpha; uniform vec3 uColor, uHot;
      void main(){ float pulse = pow(max(0., sin((vT - uTime * .35 + uOffset) * 6.2832)), 18.);
        float hot = step(vT, uFront);
        gl_FragColor = vec4(mix(uColor, uHot, hot) * (.3 + hot * .5 + pulse * 1.5), uAlpha); }`
  });
  const arcs = pairs.map(([a, b], index) => {
    const pa = places[a], pb = places[b], reach = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
    const points = new THREE.QuadraticBezierCurve3(V3(pa[0], .06, pa[1]), V3((pa[0] + pb[0]) / 2, reach * .42, (pa[1] + pb[1]) / 2), V3(pb[0], .06, pb[1])).getPoints(48);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setAttribute('aT', new THREE.BufferAttribute(Float32Array.from(points, (_, i) => i / 48), 1));
    const line = new THREE.Line(geometry, material.clone());
    line.material.uniforms.uOffset.value = random(index + 3);
    scene.add(line);
    return { line, uniforms: line.material.uniforms, cut: a === BAD || b === BAD, path: a === BAD && b === GATE ? 0 : a === GATE && b === 0 ? 1 : -1 };
  });
  const pins = places.map((place, index) => pin(scene, place, index ? .28 : .6, index ? 0xe8e8e8 : BLUE));
  const halo = flat(new THREE.CircleGeometry(.9, 48), additive(BLUE, .1), .01);
  halo.position.set(core[0], .01, core[1]); scene.add(halo);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32, 0, TAU, 0, Math.PI / 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vP, vN, vV; void main(){ vP = position; vN = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vP, vN, vV; uniform float uOpacity, uTime;
      void main(){ float rim = pow(1. - abs(dot(vN, vV)), 2.2);
        float lon = atan(vP.z, vP.x) / 6.2832, lat = asin(clamp(vP.y, 0., 1.)) / 1.5708;
        float grid = max(smoothstep(.93, .97, fract(lon * 28.)), smoothstep(.9, .95, fract(lat * 9.)));
        float sweep = smoothstep(.06, 0., abs(lat - fract(uTime * .25)));
        gl_FragColor = vec4(vec3(.17, .62, .93) * (rim * .9 + grid * .5 + sweep * .7 + .04), uOpacity); }`
  }));
  dome.position.set(places[BAD][0], 0, places[BAD][1]); scene.add(dome);
  const shock = flat(new THREE.RingGeometry(.985, 1, 96), additive(BLUE, 0), .02);
  shock.position.set(core[0], .02, core[1]); scene.add(shock);
  const target = V3(core[0], 0, core[1]), bad = V3(places[BAD][0], 0, places[BAD][1]), red = new THREE.Color(RED), white = new THREE.Color(0xe8e8e8), tint = new THREE.Color();

  return ({ time, progress, pointer, enter }) => {
    world.tick(time);
    const detect = smooth(progress, .26, .5), contain = smooth(progress, .6, .88), front = detect * 1.55;
    target.set(core[0], 0, core[1]).lerp(bad, detect * .62);
    orbit(camera, target, .35 + progress * .85 + Math.sin(time * .15) * .05 + pointer[0] * .1, .6 - pointer[1] * .03, mix(9.4, 6.6, detect));
    arcs.forEach(arc => {
      arc.uniforms.uTime.value = time;
      arc.uniforms.uAlpha.value = enter * (arc.cut ? 1 - contain : 1);
      arc.uniforms.uFront.value = arc.path === 0 ? front : arc.path === 1 ? clamp(front - 1) * (1 - contain) : 0;
    });
    pins.forEach((p, index) => p.pulse(time + index * .37, index ? .22 : .7, index === BAD ? 0 : .8));
    tint.copy(white).lerp(red, detect * (1 - contain * .5)); pins[BAD].tint(tint);
    const alarm = detect * (1 - contain);
    pins[BAD].rings.forEach((ring, index) => {
      const phase = fract(time * .7 + index * .5);
      ring.scale.setScalar(.1 + phase * .85); ring.material.opacity = (1 - phase) * alarm;
    });
    dome.scale.setScalar(.001 + .78 * smooth(contain, 0, .7));
    dome.material.uniforms.uOpacity.value = contain; dome.material.uniforms.uTime.value = time;
    shock.scale.setScalar(.1 + contain * 5); shock.material.opacity = Math.sin(contain * Math.PI) * .8;
    const calm = 1 - smooth(progress, .2, .3);
    label('core', pins[0].top, contain > .5 ? 'Core · protected' : 'Core', 'on', Math.max(calm, contain));
    label('traffic', pins[2].top, 'Traffic · nominal', '', calm);
    label('bad', V3(bad.x, mix(.3, .86, contain), bad.z), contain > .5 ? 'Isolated' : 'Anomaly · lateral movement', contain > .5 ? 'on' : 'warn', Math.max(detect, contain));
  };
}

/* ---------- Models: a field of data points, scanned, chunked and attended ---------- */
function cells({ scene, camera, label }) {
  scene.fog = null;
  const W = 8, D = 4.8, PX = 6, PZ = 4, lesion = [1.35, -.35];
  const offset = [], scale = [], kind = [], patchDir = [], patchScore = [], seed = [];
  const score = new Float32Array(PX * PZ), counts = new Float32Array(PX * PZ);
  const list = [];
  const add = (x, z, y, radius, dense) => {
    if (Math.abs(x) > W / 2 - .05 || Math.abs(z) > D / 2 - .05) return;
    const pi = Math.min(PX - 1, Math.floor((x + W / 2) / (W / PX))), pj = Math.min(PZ - 1, Math.floor((z + D / 2) / (D / PZ)));
    list.push({ x, y, z, radius, dense, patch: pi * PZ + pj, pi, pj });
    counts[pi * PZ + pj] += dense;
  };
  for (let i = 0; i < 54; i++) for (let j = 0; j < 32; j++) {
    const k = i * 61 + j, x = (i + .5) / 54 * W - W / 2 + (random(k) - .5) * .12, z = (j + .5) / 32 * D - D / 2 + (random(k + 1) - .5) * .12;
    const duct = Math.abs(Math.hypot(x + 2.3, z - .5) - .62) < .13 || Math.abs(Math.hypot(x - 2.9, z - 1.3) - .5) < .12;
    const hole = Math.hypot(x + 2.3, z - .5) < .5 || Math.hypot(x - 2.9, z - 1.3) < .38;
    if (hole || (!duct && random(k + 2) < .34)) continue;
    add(x, z, (random(k + 3) - .5) * .34, duct ? .078 : .05 + random(k + 4) * .035, 0);
  }
  for (let k = 0; k < 520; k++) {
    const a = random(k * 3 + 500) * TAU, r = Math.pow(random(k * 3 + 501), .6) * (1.05 + noise(a * 1.4, 3) * .55);
    add(lesion[0] + Math.cos(a) * r * 1.15, lesion[1] + Math.sin(a) * r, (random(k * 3 + 502) - .5) * .7, .07 + random(k * 3 + 503) * .075, 1);
  }
  const peak = Math.max(...counts);
  counts.forEach((c, i) => { score[i] = Math.pow(c / peak, .6); });
  for (const c of list) {
    offset.push(c.x, c.y, c.z); scale.push(c.radius); kind.push(c.dense); seed.push(random(offset.length));
    patchDir.push(c.pi - (PX - 1) / 2, c.pj - (PZ - 1) / 2); patchScore.push(score[c.patch]);
  }
  const base = new THREE.SphereGeometry(1, 16, 12), geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index; geometry.setAttribute('position', base.attributes.position); geometry.setAttribute('normal', base.attributes.normal);
  const instanced = (name, data, size) => geometry.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(data), size));
  instanced('aOffset', offset, 3); instanced('aScale', scale, 1); instanced('aKind', kind, 1);
  instanced('aPatch', patchDir, 2); instanced('aScore', patchScore, 1); instanced('aSeed', seed, 1);
  geometry.instanceCount = list.length;
  const uniforms = { uTime: { value: 0 }, uScan: { value: 0 }, uScanX: { value: 0 }, uSplit: { value: 0 }, uAttend: { value: 0 }, uEnter: { value: 1 } };
  const cloud = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `attribute vec3 aOffset; attribute float aScale, aKind, aScore, aSeed; attribute vec2 aPatch;
      uniform float uTime, uScan, uScanX, uSplit, uAttend, uEnter;
      varying vec3 vN, vV; varying float vKind, vScore, vScan, vDepth;
      void main(){
        vec3 centre = aOffset;
        centre.xz += aPatch * uSplit * .2;
        centre.y += uAttend * (aScore * 1.5 - (1. - aScore) * .12) + sin(uTime * .9 + aSeed * 40.) * .025;
        float appear = smoothstep(0., 1., uEnter * 1.6 - aSeed * .6);
        vScan = exp(-pow((centre.x - uScanX) / .2, 2.)) * uScan;
        float size = aScale * appear * (1. + vScan * .45 + aScore * uAttend * .25);
        vec4 mv = modelViewMatrix * vec4(centre + position * size, 1.);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        vKind = aKind; vScore = aScore; vDepth = -mv.z;
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vN, vV; varying float vKind, vScore, vScan, vDepth; uniform float uAttend;
      void main(){
        float facing = max(dot(normalize(vN), normalize(vV)), 0.), rim = pow(1. - facing, 2.4);
        vec3 core = mix(vec3(.2, .12, .34), vec3(.11, .07, .3), vKind);
        vec3 edge = mix(vec3(.86, .6, .78), vec3(.6, .5, .95), vKind);
        vec3 color = mix(core, edge, rim) + pow(facing, 24.) * .16;
        vec3 flagged = mix(vec3(.03, .2, .36), vec3(.55, .88, 1.), rim) + pow(facing, 18.) * .4;
        color = mix(color, flagged, uAttend * smoothstep(.25, .8, vScore));
        color *= mix(1., .5, uAttend * pow(1. - vScore, 1.5));
        color += vec3(.25, .7, 1.) * vScan * (.4 + rim);
        gl_FragColor = vec4(mix(color, vec3(.027, .027, .027), smoothstep(8., 17., vDepth) * .85), 1.); }`
  }));
  cloud.frustumCulled = false; scene.add(cloud);

  const pw = W / PX, pd = D / PZ;
  const centre = (patch, split) => { const pi = Math.floor(patch / PZ), pj = patch % PZ; return [(pi + .5) * pw - W / 2 + (pi - (PX - 1) / 2) * split * .2, (pj + .5) * pd - D / 2 + (pj - (PZ - 1) / 2) * split * .2]; };
  const outline = new THREE.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, -1], [1, 1], [1, 1], [-1, 1], [-1, 1], [-1, -1]].map(p => V3(p[0] * pw * .48, 0, p[1] * pd * .48)));
  const frames = Array.from(score, (s, patch) => {
    const frame = new THREE.LineSegments(outline, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    scene.add(frame); return frame;
  });
  const ranked = Array.from(score, (s, patch) => ({ s, patch })).sort((a, b) => b.s - a.s).slice(0, 4);
  const total = score.reduce((sum, s) => sum + Math.exp(s * 3), 0);
  const token = new THREE.Mesh(new THREE.OctahedronGeometry(.13), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }));
  const tokenGlow = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 12), new THREE.MeshBasicMaterial({ color: BLUE }));
  token.position.set(0, 3.1, 0); tokenGlow.position.copy(token.position); scene.add(token, tokenGlow);
  const beams = ranked.map(() => { const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(), V3()]), additive(BLUE, 0)); scene.add(beam); return beam; });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(D + .6, 1.5), additive(BLUE, .1));
  plane.rotation.y = Math.PI / 2;
  const edge = new THREE.Mesh(new THREE.BoxGeometry(.012, .012, D + .6), new THREE.MeshBasicMaterial({ color: 0x8fd3ff, transparent: true }));
  scene.add(plane, edge);
  const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(Float32Array.from({ length: 900 }, (_, i) => (random(i + 77) - .5) * (i % 3 === 1 ? 7 : 16)), 3)),
    new THREE.PointsMaterial({ color: 0x6f7f95, size: .022, transparent: true, opacity: .55 }));
  scene.add(dust);
  const target = V3();

  return ({ time, progress, enter, pointer }) => {
    const split = smooth(progress, .28, .5), attend = smooth(progress, .6, .88);
    const scan = (1 - smooth(progress, .2, .32)) * smooth(enter, .4, .9), scanX = Math.sin(time * .6) * (W / 2 + .2);
    uniforms.uTime.value = time; uniforms.uScan.value = scan; uniforms.uScanX.value = scanX;
    uniforms.uSplit.value = split; uniforms.uAttend.value = attend; uniforms.uEnter.value = enter;
    plane.position.set(scanX, .15, 0); plane.material.opacity = scan * .1;
    edge.position.set(scanX, -.32, 0); edge.material.opacity = scan;
    frames.forEach((frame, patch) => {
      const [x, z] = centre(patch, split), s = score[patch];
      frame.position.set(x, -.36 + attend * (s * 1.5 - (1 - s) * .12), z);
      frame.material.opacity = split * mix(.16, .9, attend * s) * (1 - attend * (1 - s) * .6);
      frame.material.color.set(attend * s > .3 ? 0x8fd3ff : 0xffffff);
    });
    token.visible = tokenGlow.visible = attend > .01;
    token.scale.setScalar(attend); token.rotation.y = time * .6; tokenGlow.scale.setScalar(attend * (1 + Math.sin(time * 3) * .15));
    ranked.forEach(({ s, patch }, index) => {
      const [x, z] = centre(patch, split), y = -.2 + attend * s * 1.5 + .35;
      beams[index].geometry.setFromPoints([token.position, V3(x, y, z)]);
      beams[index].material.opacity = attend * (.9 - index * .17);
      const weight = (Math.exp(s * 3) / total).toFixed(2);
      label(`rank${index}`, V3(x + pw * .45, y, z), index ? `Weight ${weight}` : `Strongest signal · weight ${weight}`, index ? '' : 'on', attend, 10, -8, index === 0);
    });
    label('token', token.position, 'Summary token', '', attend);
    label('scan', V3(scanX, -.32, D / 2 + .3), 'Data in', '', scan, 8, 4);
    label('patches', V3(-W / 2, -.3, D / 2), `${PX * PZ} chunks → ${PX * PZ} tokens`, '', smooth(progress, .34, .46) * (1 - smooth(progress, .56, .64)), 0, 14);
    dust.rotation.y = time * .015;
    target.set(0, .1 + attend * .9, 0);
    orbit(camera, target, .5 + progress * .9 + Math.sin(time * .2) * .05 + pointer[0] * .12, mix(.62, .4, attend) - pointer[1] * .04, 12.2);
  };
}

/* ---------- Software: a tangle of threads resolves into a woven system ---------- */
function ribbons({ scene, camera, label }) {
  const LINES = 132, POINTS = 150, LAYERS = 3, perLayer = LINES / LAYERS;
  const chaos = [], order = [], along = [], meta = [], ends = [];
  for (let l = 0; l < LINES; l++) {
    const layer = l % LAYERS, lane = Math.floor(l / LAYERS) / (perLayer - 1) * 2 - 1;
    const f = [1 + random(l * 7) * 2.4, 1 + random(l * 7 + 1) * 2.4, 1 + random(l * 7 + 2) * 2.4], p = [random(l * 7 + 3) * TAU, random(l * 7 + 4) * TAU, random(l * 7 + 5) * TAU];
    const radius = 1.5 + random(l * 7 + 6) * 1.1, hop = random(l * 13 + 9) < .3 ? (layer + 1) % LAYERS : layer, hopAt = (random(l * 17) - .5) * 1.6;
    const point = t => {
      const x = (t - .5) * 7.2, weave = .3 + .7 * Math.abs(Math.cos(x * 1.31));
      const y = mix(layer - 1, hop - 1, smooth(x, hopAt - .45, hopAt + .45)) * 1.05;
      return { c: [radius * Math.sin(f[0] * t * TAU * .55 + p[0]), radius * .8 * Math.sin(f[1] * t * TAU * .55 + p[1]), radius * Math.sin(f[2] * t * TAU * .55 + p[2])],
        o: [x, y + Math.sin(x * 2 + layer * 2) * .05, lane * 1.5 * weave] };
    };
    for (let i = 0; i < POINTS - 1; i++) for (const t of [i / (POINTS - 1), (i + 1) / (POINTS - 1)]) {
      const q = point(t);
      chaos.push(...q.c); order.push(...q.o); along.push(t); meta.push(random(l * 3 + 40), random(l * 3 + 41), layer / (LAYERS - 1));
    }
    ends.push(...point(0).o, ...point(1).o);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(order), 3));
  geometry.setAttribute('aChaos', new THREE.BufferAttribute(new Float32Array(chaos), 3));
  geometry.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(along), 1));
  geometry.setAttribute('aMeta', new THREE.BufferAttribute(new Float32Array(meta), 3));
  const uniforms = { uTime: { value: 0 }, uOrder: { value: 0 }, uRun: { value: 0 }, uEnter: { value: 1 } };
  const threads = new THREE.LineSegments(geometry, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aChaos, aMeta; attribute float aT; uniform float uTime, uOrder, uRun, uEnter; varying float vGlow, vK, vLayer, vFade;
      void main(){
        float k = smoothstep(0., 1., (uOrder * 1.55 - aMeta.x * .55));
        float a = uTime * (.08 + aMeta.y * .16) * (1. - k);
        vec3 c = vec3(aChaos.x * cos(a) - aChaos.z * sin(a), aChaos.y + sin(uTime * .5 + aMeta.x * 20.) * .12, aChaos.x * sin(a) + aChaos.z * cos(a));
        vec3 p = mix(c, position, k);
        p.y += sin(k * 3.1416) * (aMeta.y - .5) * 1.2;
        vGlow = pow(max(0., sin((aT * 2. - uTime * .55 + aMeta.x) * 6.2832)), 22.) * uRun;
        vK = k; vLayer = aMeta.z; vFade = uEnter;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
    fragmentShader: `varying float vGlow, vK, vLayer, vFade;
      void main(){ vec3 tangle = vec3(.62, .64, .7), system = mix(vec3(.75, .78, .84), vec3(.17, .62, .93), vLayer);
        vec3 color = mix(tangle, system, vK) * mix(.22, .38, vK) + vec3(.55, .85, 1.) * vGlow * 1.6;
        gl_FragColor = vec4(color * vFade, 1.); }`
  }));
  threads.frustumCulled = false; scene.add(threads);
  const ports = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(ends), 3)),
    new THREE.PointsMaterial({ color: 0xffffff, size: .05, transparent: true, opacity: 0, depthWrite: false }));
  scene.add(ports);
  const gates = [-1.2, 1.2].map(x => {
    const gate = new THREE.Mesh(new THREE.TorusGeometry(1.72, .006, 6, 96), additive(0xffffff, 0));
    gate.rotation.y = Math.PI / 2; gate.scale.set(1, .82, 1); gate.position.x = x; scene.add(gate); return gate;
  });
  const target = V3();
  return ({ time, progress, enter, pointer }) => {
    const ordered = smooth(progress, .24, .6), run = smooth(progress, .64, .9);
    uniforms.uTime.value = time; uniforms.uOrder.value = ordered; uniforms.uRun.value = run; uniforms.uEnter.value = smooth(enter, .1, .8);
    ports.material.opacity = smooth(ordered, .7, 1);
    gates.forEach((gate, index) => { gate.material.opacity = smooth(ordered, .75, 1) * (.07 + run * .08 * (.5 + .5 * Math.sin(time * 2 + index * 2))); });
    orbit(camera, target, .55 + progress * .55 + Math.sin(time * .17) * .06 + pointer[0] * .14, mix(.18, .34, ordered) - pointer[1] * .05, mix(8.4, 9.4, ordered));
    label('raw', V3(1.6, 1.6, 0), 'Unstructured problem', '', (1 - smooth(progress, .14, .26)) * enter);
    label('layers', V3(-3.6, 1.05, 1.5), '3 layers · clear interfaces', '', smooth(progress, .46, .58) * (1 - smooth(progress, .62, .68)), -10, -18);
    label('in', V3(-3.6, -1.05, 0), 'In', '', run, -30, 0);
    label('out', V3(3.6, 1.05, 0), 'Out · verified', 'on', run);
  };
}

/* ---------- Aurora: soft light curtains for the gradient bands ---------- */
const TONES = {
  green: [[.16, .42, .27], [.33, .6, .58], [.52, .55, .85], [.42, .3, .7], [.78, .92, .5]],
  blue: [[.1, .27, .45], [.2, .5, .7], [.45, .7, .92], [.3, .32, .7], [.55, .9, .85]]
};
function aurora({ scene, canvas }) {
  const tone = TONES[canvas.dataset.tone] || TONES.green, uniforms = { uTime: { value: 0 }, uAspect: { value: 1 } };
  tone.forEach((c, i) => { uniforms['uC' + i] = { value: new THREE.Vector3(...c) }; });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime, uAspect; uniform vec3 uC0, uC1, uC2, uC3, uC4;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * n(p); p *= 2.03; a *= .5; } return v; }
      void main(){
        vec2 uv = vUv; float t = uTime * .045; float x = uv.x * uAspect;
        // Broad colour field drifting sideways.
        float f1 = fbm(vec2(x * .55 + t, t * .7)), f2 = fbm(vec2(x * .9 - t * .8 + 7., uv.y * .6 + t));
        vec3 col = mix(uC0, uC1, smoothstep(.3, .75, f1));
        col = mix(col, uC2, smoothstep(.55, .85, f2) * smoothstep(.15, .9, uv.y));
        col = mix(col, uC3, smoothstep(.5, .9, fbm(vec2(x * .7 + 13. + t * .6, t))) * smoothstep(.85, .1, uv.y) * smoothstep(.75, .05, uv.x));
        // Vertical curtain rays, bent slowly by the field.
        float warp = fbm(vec2(x * 1.4 + t * 1.5, uv.y * .8)) * 1.6;
        float rays = fbm(vec2(x * 7. + warp, uv.y * .35 - t * .4));
        col += (rays - .45) * .32 * smoothstep(0., .6, uv.y + .2);
        // Warm glow rising from the bottom centre.
        float glow = exp(-pow((uv.x - .5 - .12 * sin(t * 3.)) * 2.2, 2.)) * smoothstep(.55, 0., uv.y);
        col = mix(col, uC4, glow * .75 * (.7 + .3 * rays));
        // Vignette, then grain to keep the gradient from banding.
        float v = smoothstep(1.25, .35, length((uv - vec2(.5, .55)) * vec2(1.1, 1.25)));
        col *= mix(.55, 1., v);
        col += (h(uv * 900. + uTime) - .5) * .03;
        gl_FragColor = vec4(col, 1.); }`
  }));
  quad.frustumCulled = false; scene.add(quad);
  return ({ time, aspect }) => { uniforms.uTime.value = time; uniforms.uAspect.value = aspect; };
}

/* ---------- Controller ---------- */
const factories = { map, cells, ribbons, aurora };
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const pointer = [0, 0], eased = [0, 0];
let aim = null, time = 0, last = 0, raf = 0;

const stages = [...document.querySelectorAll('canvas[data-scene]')].map(canvas => {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (error) { canvas.classList.add('is-unavailable'); return null; }
  // The aurora is soft by design, so it renders at 1x; everything else up to 2x.
  renderer.setPixelRatio(canvas.dataset.scene === 'aurora' ? 1 : Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, .1, 80);
  const host = canvas.parentElement, labels = new Map(), size = { w: 0, h: 0 }, projected = V3();
  function label(key, position, text, kind = '', alpha = 1, dx = 12, dy = -12) {
    let entry = labels.get(key);
    if (!entry) {
      const element = document.createElement('span');
      element.className = 'tag3d'; element.setAttribute('aria-hidden', 'true'); host.appendChild(element);
      labels.set(key, entry = { element, text: '', kind: null, width: 0 });
    }
    if (entry.text !== text) { entry.element.textContent = entry.text = text; entry.width = entry.element.offsetWidth; }
    if (entry.kind !== kind) { entry.element.className = `tag3d ${kind}`; entry.kind = kind; }
    projected.copy(position).project(camera);
    const x = clamp((projected.x * .5 + .5) * size.w + dx, 4, Math.max(4, size.w - entry.width - 4));
    entry.element.style.transform = `translate(${Math.round(x)}px, ${Math.round((1 - (projected.y * .5 + .5)) * size.h + dy)}px)`;
    entry.element.style.opacity = alpha > .05 && projected.z < 1 ? Math.min(1, alpha).toFixed(2) : '0';
  }
  const update = factories[canvas.dataset.scene]({ scene, camera, mode: canvas.dataset.mode, label, canvas });
  const story = canvas.closest('[data-story]');
  return { canvas, renderer, scene, camera, update, story, size, steps: story ? [...story.querySelectorAll('[data-step]')] : [], active: -1 };
}).filter(Boolean);

function frame(now) {
  if (last) time += Math.min((now - last) / 1000, .06);
  last = now;
  eased[0] += (pointer[0] - eased[0]) * .06; eased[1] += (pointer[1] - eased[1]) * .06;
  const view = innerHeight, clock = reduced.matches ? 4 : time;
  for (const item of stages) {
    const box = item.canvas.getBoundingClientRect();
    if (box.bottom < -20 || box.top > view + 20 || box.width < 2) continue;
    const anchor = item.story ? item.story.getBoundingClientRect() : box;
    const progress = item.story ? clamp(-anchor.top / Math.max(1, anchor.height - view)) : clamp((view - box.top) / (view + box.height));
    const enter = reduced.matches ? 1 : clamp((view - anchor.top) / (view * .6));
    if (item.story) {
      item.story.style.setProperty('--progress', progress.toFixed(3));
      const active = Math.min(item.steps.length - 1, Math.floor(progress * item.steps.length));
      if (active !== item.active) { item.active = active; item.steps.forEach((step, index) => step.classList.toggle('is-active', index === active)); }
    }
    const w = Math.round(box.width), h = Math.round(box.height);
    if (w !== item.size.w || h !== item.size.h) {
      item.size.w = w; item.size.h = h; item.renderer.setSize(w, h, false);
      // Keep the composition readable on tall, narrow stages.
      item.camera.aspect = w / h; item.camera.fov = 32 * Math.max(1, Math.min(1.45, 1.15 / item.camera.aspect));
      // Wide layouts put copy on the left, so the subject sits right of centre.
      const shift = w > 900 ? +(item.canvas.dataset.shift || 0) : 0;
      // Narrow layouts put copy at the bottom, so the subject sits above centre.
      const lift = w <= 900 && item.story ? .15 : 0;
      if (shift || lift) item.camera.setViewOffset(w, h, -w * shift, h * lift, w, h); else item.camera.clearViewOffset();
      item.camera.updateProjectionMatrix();
    }
    const focus = item.canvas.dataset.focus === undefined || item.canvas.dataset.focus === '' ? -1 : +item.canvas.dataset.focus;
    const needle = aim ? Math.atan2(-(aim[1] - (box.top + box.height / 2)), aim[0] - (box.left + box.width / 2)) : null;
    item.update({ time: clock, progress, enter, pointer: eased, focus, aim: needle, aspect: item.camera.aspect });
    item.renderer.render(item.scene, item.camera);
  }
}
function loop(now) { frame(now); raf = requestAnimationFrame(loop); }
function sync() {
  cancelAnimationFrame(raf); last = 0;
  if (reduced.matches || document.hidden) { for (let i = 0; i < 3; i++) frame(performance.now()); }
  else raf = requestAnimationFrame(loop);
}
addEventListener('pointermove', event => {
  if (event.pointerType === 'touch') return;
  pointer[0] = event.clientX / innerWidth * 2 - 1; pointer[1] = event.clientY / innerHeight * 2 - 1;
  aim = [event.clientX, event.clientY];
}, { passive: true });
document.addEventListener('pointerleave', () => { aim = null; pointer[0] = pointer[1] = 0; });
const still = () => { if (reduced.matches) frame(performance.now()); };
addEventListener('scroll', still, { passive: true }); addEventListener('resize', still);
reduced.addEventListener('change', sync); document.addEventListener('visibilitychange', sync);
sync();
