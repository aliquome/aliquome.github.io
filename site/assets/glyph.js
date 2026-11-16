// Generated 3D figures. Every database or dataset gets its own figure, built
// from its name: the name seeds the random numbers and is also read as a base
// sequence (A, C, G, T) that colours the parts. The research field picks the
// family of shape: a double helix for genomes, a folded chain for proteins,
// a cell cloud for single-cell data, and so on.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const BASES = ["A", "C", "G", "T"];

export function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The name written as bases. Also used for the flat colour strip. */
export function sequence(text, length = 32) {
  const out = [];
  let h = hash(text);
  for (let i = 0; i < length; i++) {
    const code = i < text.length ? text.charCodeAt(i) : (h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0);
    out.push(BASES[(code + (code >>> 3)) & 3]);
  }
  return out;
}

// Theme tokens are written in oklch, which three.js cannot parse. Paint each
// one onto a 1-pixel canvas and read back plain sRGB.
const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
function toColor(css) {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#888888";
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return new THREE.Color(r / 255, g / 255, b / 255).convertSRGBToLinear();
}

function palette() {
  const css = getComputedStyle(document.documentElement);
  const read = (name) => toColor(css.getPropertyValue(name).trim() || "#888888");
  return {
    A: read("--base-a"), C: read("--base-c"), G: read("--base-g"), T: read("--base-t"),
    ink: read("--muted"),
  };
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function builder(group, colors) {
  const mats = new Map();
  const mat = (key) => {
    if (!mats.has(key)) {
      mats.set(key, new THREE.MeshStandardMaterial({ color: colors[key], roughness: 0.42, metalness: 0.08 }));
    }
    return mats.get(key);
  };
  const sphereGeo = new THREE.SphereGeometry(1, 20, 14);
  return {
    mat,
    ball(p, r, key) {
      const m = new THREE.Mesh(sphereGeo, mat(key));
      m.position.copy(p);
      m.scale.setScalar(r);
      group.add(m);
      return m;
    },
    stick(a, b, r, key) {
      const dir = b.clone().sub(a);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 10), mat(key));
      m.position.copy(a).addScaledVector(dir, 0.5);
      m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
      group.add(m);
    },
    tube(points, r, key, closed = false) {
      const curve = new THREE.CatmullRomCurve3(points, closed);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 8, r, 10, closed), mat(key)));
    },
  };
}

const shapes = {
  helix(b, rnd, seq, opts = {}) {
    const n = 22 + Math.floor(rnd() * 8);
    const turns = 1.6 + rnd() * 1.2;
    const radius = 0.5 + rnd() * 0.12;
    const s1 = [], s2 = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = t * turns * Math.PI * 2;
      const y = (t - 0.5) * 2.5;
      s1.push(V(Math.cos(a) * radius, y, Math.sin(a) * radius));
      s2.push(V(Math.cos(a + Math.PI) * radius, y, Math.sin(a + Math.PI) * radius));
    }
    b.tube(s1, 0.05, "ink");
    b.tube(s2, 0.05, "ink");
    for (let i = 0; i < n; i++) {
      const key = seq[i % seq.length];
      const mid = s1[i].clone().lerp(s2[i], 0.5);
      b.stick(s1[i], mid, 0.035, key);
      b.stick(mid, s2[i], 0.035, BASES[3 - BASES.indexOf(key)]);
      if (opts.variants && rnd() < 0.16) b.ball(mid, 0.13, "T");
    }
  },
  variant(b, rnd, seq) {
    shapes.helix(b, rnd, seq, { variants: true });
  },
  fold(b, rnd, seq) {
    const n = 14 + Math.floor(rnd() * 8);
    const pts = [];
    let p = V(0, 0, 0);
    let d = V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    for (let i = 0; i < n; i++) {
      pts.push(p.clone());
      d.add(V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(1.5)).normalize();
      d.addScaledVector(p, -0.35).normalize();
      p = p.clone().addScaledVector(d, 0.42);
    }
    const centre = pts.reduce((a, q) => a.add(q), V(0, 0, 0)).multiplyScalar(1 / n);
    let far = 0;
    pts.forEach((q) => { q.sub(centre); far = Math.max(far, q.length()); });
    pts.forEach((q) => q.multiplyScalar(1.2 / far));
    b.tube(pts, 0.07, seq[0]);
    pts.forEach((q, i) => { if (i % 2 === 0) b.ball(q, 0.11, seq[i % seq.length]); });
  },
  cells(b, rnd, seq, group) {
    const clusters = 4 + Math.floor(rnd() * 4);
    const positions = [], colours = [];
    for (let c = 0; c < clusters; c++) {
      const centre = V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(1.7);
      const spread = 0.16 + rnd() * 0.22;
      const colour = b.mat(seq[c % seq.length]).color;
      const count = 70 + Math.floor(rnd() * 90);
      for (let i = 0; i < count; i++) {
        const g = () => (rnd() + rnd() + rnd() - 1.5) * spread * 1.6;
        positions.push(centre.x + g(), centre.y + g(), centre.z + g());
        colours.push(colour.r, colour.g, colour.b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
    group.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.075, vertexColors: true })));
  },
  network(b, rnd, seq) {
    const n = 16 + Math.floor(rnd() * 12);
    const nodes = [];
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.399963 + rnd() * 0.6;
      nodes.push(V(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(0.85 + rnd() * 0.35));
    }
    const degree = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const near = nodes.map((q, j) => [q.distanceTo(nodes[i]), j]).sort((x, y) => x[0] - y[0]);
      const links = 1 + Math.floor(rnd() * 2);
      for (let k = 1; k <= links; k++) {
        const j = near[k][1];
        b.stick(nodes[i], nodes[j], 0.018, "ink");
        degree[i]++; degree[j]++;
      }
    }
    nodes.forEach((q, i) => b.ball(q, 0.07 + degree[i] * 0.018, seq[i % seq.length]));
  },
  molecule(b, rnd, seq) {
    const atoms = [];
    const ring = (centre, tilt) => {
      const out = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const p = V(Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0).applyAxisAngle(V(1, 0, 0), tilt).add(centre);
        out.push(p);
      }
      out.forEach((p, i) => b.stick(p, out[(i + 1) % 6], 0.04, "ink"));
      atoms.push(...out);
      return out;
    };
    const first = ring(V(-0.4, 0, 0), rnd() * 0.5);
    if (rnd() > 0.35) ring(V(0.42, 0.08, 0.05), rnd() * 0.5 - 0.25);
    const arms = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < arms; k++) {
      let p = first[Math.floor(rnd() * 6)].clone();
      const steps = 1 + Math.floor(rnd() * 3);
      for (let s = 0; s < steps; s++) {
        const q = p.clone().add(V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(0.42));
        b.stick(p, q, 0.04, "ink");
        atoms.push(q);
        p = q;
      }
    }
    atoms.forEach((p, i) => b.ball(p, i % 5 === 0 ? 0.15 : 0.11, seq[i % seq.length]));
  },
  chromatin(b, rnd, seq, group) {
    const n = 6 + Math.floor(rnd() * 3);
    const path = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = t * Math.PI * (1.6 + rnd() * 0.4);
      path.push(V(Math.cos(a) * 0.75, (t - 0.5) * 2.1, Math.sin(a) * 0.75));
    }
    b.tube(path, 0.03, "ink");
    path.forEach((p, i) => {
      const key = seq[i % seq.length];
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.17, 20), b.mat(key));
      core.position.copy(p);
      core.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      group.add(core);
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.03, 8, 28), b.mat("ink"));
      wrap.position.copy(p);
      wrap.quaternion.copy(core.quaternion);
      wrap.rotateX(Math.PI / 2);
      group.add(wrap);
    });
  },
  hairpin(b, rnd, seq) {
    const pairs = 6 + Math.floor(rnd() * 4);
    const left = [], right = [];
    for (let i = 0; i < pairs; i++) {
      const y = -1.15 + i * 0.22;
      const lean = Math.sin(i * 0.7) * 0.06;
      left.push(V(-0.24, y, lean));
      right.push(V(0.24, y, -lean));
    }
    const top = -1.15 + pairs * 0.22;
    const loop = [];
    const loopR = 0.42 + rnd() * 0.12;
    // The loop runs from the right strand over the top to the left strand.
    for (let i = 1; i < 8; i++) {
      const a = Math.PI - (i / 8) * Math.PI * 2;
      loop.push(V(Math.sin(a) * loopR, top + loopR * 0.9 + Math.cos(a) * loopR * 0.9, 0));
    }
    const tail = [V(0.95, -1.3, 0.25), V(0.55, -1.32, 0.1)];
    b.tube([...tail, ...right, ...loop, ...left.slice().reverse()], 0.045, "ink");
    for (let i = 0; i < pairs; i++) {
      const key = seq[i % seq.length];
      b.stick(left[i], right[i], 0.03, key);
    }
    loop.forEach((p, i) => b.ball(p, 0.09, seq[(i + pairs) % seq.length]));
  },
  microbes(b, rnd, seq, group) {
    const n = 7 + Math.floor(rnd() * 6);
    for (let i = 0; i < n; i++) {
      const key = seq[i % seq.length];
      const p = V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(2);
      if (rnd() < 0.3) { b.ball(p, 0.16 + rnd() * 0.08, key); continue; }
      const cell = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3 + rnd() * 0.3, 6, 14), b.mat(key));
      cell.position.copy(p);
      cell.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      group.add(cell);
    }
  },
  tumour(b, rnd, seq, group) {
    const geo = new THREE.IcosahedronGeometry(0.85, 3);
    const pos = geo.attributes.position;
    const k = 1.5 + rnd() * 2.5, ph = rnd() * 6;
    for (let i = 0; i < pos.count; i++) {
      const v = V(pos.getX(i), pos.getY(i), pos.getZ(i));
      const bump = Math.sin(v.x * k + ph) * Math.cos(v.y * k * 1.3 + ph) * Math.sin(v.z * k * 0.8 + ph);
      v.multiplyScalar(1 + bump * 0.28);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    group.add(new THREE.Mesh(geo, b.mat(seq[0])));
    const clones = 5 + Math.floor(rnd() * 5);
    for (let i = 0; i < clones; i++) {
      const p = V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(1.05 + rnd() * 0.35);
      b.ball(p, 0.08 + rnd() * 0.1, seq[(i + 1) % seq.length]);
    }
  },
  bars(b, rnd, seq, group) {
    const size = 4, gap = 0.42;
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const h = 0.25 + rnd() * 1.6;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 0.3), b.mat(seq[(x * size + z) % seq.length]));
        bar.position.set((x - (size - 1) / 2) * gap, h / 2 - 0.9, (z - (size - 1) / 2) * gap);
        group.add(bar);
      }
    }
  },
};

export function buildGlyph(name, shape) {
  const group = new THREE.Group();
  const seq = sequence(name);
  const rnd = rng(hash(name));
  const b = builder(group, palette());
  (shapes[shape] || shapes.network)(b, rnd, seq, group);
  group.rotation.set(0.25 + rnd() * 0.3, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.3);
  return group;
}

function light(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x556080, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(2.5, 3.5, 4);
  scene.add(sun);
}

function dispose(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
}

// ---- chromatogram trace: the name drawn as a Sanger sequencing read ----
export function trace(name, length = 36) {
  const seq = sequence(name, length);
  const w = 360, h = 34, step = w / length;
  const curves = { A: [], C: [], G: [], T: [] };
  const rnd = rng(hash(name) ^ 0x9e3779b9);
  const peaks = seq.map((b, i) => ({ b, x: step * (i + 0.5), amp: 0.62 + rnd() * 0.33 }));
  for (const base of BASES) {
    let d = "";
    for (let x = 0; x <= w; x += 2) {
      let y = 0;
      for (const p of peaks) {
        const dx = (x - p.x) / (step * 0.34);
        if (dx > -4 && dx < 4) y += (p.b === base ? p.amp : 0.05) * Math.exp(-dx * dx);
      }
      d += `${x === 0 ? "M" : "L"}${x},${(h - 2 - y * (h - 6)).toFixed(1)}`;
    }
    curves[base] = d;
  }
  return `<svg class="trace" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${BASES.map(
    (b) => `<path class="${b}" d="${curves[b]}"/>`
  ).join("")}</svg>`;
}

// ---- still images for cards: one hidden renderer, drawn one per frame ----
let still = null;
const cache = new Map();
const queue = [];
let pumping = false;

export function clearThumbs() {
  cache.clear();
}

/** Queue an <img data-name data-shape> for drawing; keeps scrolling smooth. */
export function requestThumb(img) {
  queue.push(img);
  if (pumping) return;
  pumping = true;
  const idle = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 16));
  const pump = (deadline) => {
    while (queue.length && deadline.timeRemaining() > 4) {
      const el = queue.shift();
      if (!el.isConnected) continue;
      const url = thumb(el.dataset.name, el.dataset.shape);
      if (url) {
        el.src = url;
        el.classList.add("ready");
      }
    }
    if (queue.length) idle(pump);
    else pumping = false;
  };
  idle(pump);
}

export function thumb(name, shape) {
  const key = shape + "|" + name;
  if (cache.has(key)) return cache.get(key);
  try {
    if (!still) {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setSize(352, 220, false);
      const camera = new THREE.PerspectiveCamera(32, 352 / 220, 0.1, 50);
      camera.position.set(0, 0, 6.2);
      still = { renderer, camera };
    }
    const scene = new THREE.Scene();
    light(scene);
    const group = buildGlyph(name, shape);
    scene.add(group);
    still.renderer.render(scene, still.camera);
    const url = still.renderer.domElement.toDataURL("image/png");
    dispose(group);
    cache.set(key, url);
    return url;
  } catch (err) {
    cache.set(key, "");
    return "";
  }
}

// ---- live figure: rotates, can be dragged ----
export function mountLive(canvas, name, shape) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    return () => {};
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  light(scene);
  const group = buildGlyph(name, shape);
  scene.add(group);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0, 6);
  const controls = new OrbitControls(camera, canvas);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.autoRotate = !calm;
  controls.autoRotateSpeed = 1.1;

  const fit = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const watcher = new ResizeObserver(fit);
  watcher.observe(canvas);
  fit();

  // Only animate while the canvas is on screen and the tab is visible.
  let frame = 0, alive = true, visible = true;
  const loop = () => {
    frame = 0;
    if (!alive || !visible || document.hidden) return;
    controls.update();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  };
  const wake = () => { if (!frame) loop(); };
  const seen = new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); });
  seen.observe(canvas);
  document.addEventListener("visibilitychange", wake);
  loop();

  return () => {
    alive = false;
    cancelAnimationFrame(frame);
    seen.disconnect();
    document.removeEventListener("visibilitychange", wake);
    watcher.disconnect();
    controls.dispose();
    dispose(group);
    renderer.dispose();
  };
}
