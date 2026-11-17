// A slow, quiet "microscope field" behind the home hero: cells with a
// membrane, a nucleus and a few organelles drift and gently deform.
// Colours come from the theme's base tokens. Stops when off screen,
// and draws a single still frame for viewers who prefer reduced motion.

function tokens() {
  const css = getComputedStyle(document.documentElement);
  const get = (n) => css.getPropertyValue(n).trim() || "#888";
  return [get("--base-a"), get("--base-c"), get("--base-g"), get("--base-t")];
}

function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mountCells(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const rnd = rng(20261116);
  const colours = tokens();
  let w = 0, h = 0, dpr = 1;
  const cells = Array.from({ length: 14 }, (_, i) => ({
    x: rnd(), y: rnd(), r: 26 + rnd() * 38, c: colours[i % 4],
    vx: (rnd() - 0.5) * 0.00006, vy: (rnd() - 0.5) * 0.00006,
    phase: rnd() * 6.28, wobble: 0.05 + rnd() * 0.06,
    organelles: Array.from({ length: 3 + Math.floor(rnd() * 4) }, () => [rnd() * 6.28, 0.35 + rnd() * 0.45, 2 + rnd() * 3]),
  }));

  const fit = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = (t) => {
    ctx.clearRect(0, 0, w, h);
    for (const cell of cells) {
      cell.x += cell.vx * 16;
      cell.y += cell.vy * 16;
      if (cell.x < -0.15) cell.x += 1.3; else if (cell.x > 1.15) cell.x -= 1.3;
      if (cell.y < -0.15) cell.y += 1.3; else if (cell.y > 1.15) cell.y -= 1.3;
      const cx = cell.x * w, cy = cell.y * h, r = cell.r;
      ctx.beginPath();
      for (let k = 0; k <= 48; k++) {
        const a = (k / 48) * Math.PI * 2;
        const rr = r * (1 + cell.wobble * Math.sin(a * 3 + t * 0.0006 + cell.phase) + 0.03 * Math.sin(a * 5 - t * 0.0004));
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.globalAlpha = 0.11; ctx.fillStyle = cell.c; ctx.fill();
      ctx.globalAlpha = 0.4; ctx.strokeStyle = cell.c; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.globalAlpha = 0.26; ctx.beginPath();
      ctx.arc(cx + r * 0.12 * Math.sin(cell.phase), cy - r * 0.1, r * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.35;
      for (const [a, d, s] of cell.organelles) {
        const aa = a + t * 0.00015;
        ctx.beginPath(); ctx.arc(cx + Math.cos(aa) * r * d, cy + Math.sin(aa) * r * d, s, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  fit();
  // Resizing clears the canvas; draw again so a still frame always remains.
  const watcher = new ResizeObserver(() => { fit(); draw(performance.now()); });
  watcher.observe(canvas);
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let frame = 0, visible = true, alive = true;
  const loop = (t) => {
    frame = 0;
    if (!alive || !visible || document.hidden) return;
    draw(t);
    if (!calm) frame = requestAnimationFrame(loop);
  };
  const wake = () => { if (!frame) frame = requestAnimationFrame(loop); };
  const seen = new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); });
  seen.observe(canvas);
  document.addEventListener("visibilitychange", wake);
  wake();
  return () => {
    alive = false;
    cancelAnimationFrame(frame);
    seen.disconnect();
    watcher.disconnect();
    document.removeEventListener("visibilitychange", wake);
  };
}
