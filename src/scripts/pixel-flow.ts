/** Slow satin folds, with muted mineral pigments and a fine, stationary grain. */
export function enhancePixelFlow(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const darkTheme = matchMedia('(prefers-color-scheme: dark)');
  const palettes = {
    light: {
      base: [255, 255, 255],
      sage: [166, 187, 171],
      clay: [199, 180, 174],
      sheen: [235, 231, 216],
    },
    dark: {
      base: [10, 10, 10],
      sage: [76, 99, 83],
      clay: [95, 76, 79],
      sheen: [132, 142, 119],
    },
  } as const;
  const noise = new Float32Array(64 * 64);
  let seed = 82973;
  for (let i = 0; i < noise.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    noise[i] = seed / 4294967296;
  }

  function sample(x: number, y: number) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = noise[(iy & 63) * 64 + (ix & 63)]!;
    const b = noise[(iy & 63) * 64 + ((ix + 1) & 63)]!;
    const c = noise[((iy + 1) & 63) * 64 + (ix & 63)]!;
    const d = noise[((iy + 1) & 63) * 64 + ((ix + 1) & 63)]!;
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  function field(x: number, y: number) {
    return (
      sample(x, y) * 0.57 +
      sample(x * 2.03 + 13, y * 2.03 + 7) * 0.29 +
      sample(x * 4.09 + 3, y * 4.09 + 19) * 0.14
    );
  }

  let pixels: ImageData;
  let visible = false;
  let frameId = 0;
  let lastFrame = 0;
  let time = 0;

  function draw() {
    const { width, height, data } = pixels;
    const palette = darkTheme.matches ? palettes.dark : palettes.light;
    const drift = time * 0.21;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const u = (x / width - 0.5) * 4.2;
        const v = (y / width - 0.5) * 4.2;
        const warp = field(
          u * 0.6 + 11 + drift * 0.25,
          v * 0.6 + 7 - drift * 0.18,
        );
        const sweep =
          u * 0.72 -
          v * 0.28 +
          Math.sin(v * 0.75 + drift * 0.4) * 0.6 +
          (warp - 0.5) * 1.7;
        const phase = sweep * 4.2 - drift;
        const wave = (Math.sin(phase) + 1) * 0.5;
        const fold = wave * wave * (3 - 2 * wave) * 0.85;
        const sheen = Math.pow((Math.cos(phase - 0.45) + 1) * 0.5, 12) * 0.55;
        const tint =
          (Math.sin(u * 0.45 + v * 0.35 + drift * 0.3 + warp * 2) + 1) * 0.5;
        const grain = (noise[(y & 63) * 64 + (x & 63)]! - 0.5) * 3;
        const offset = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          const pigment =
            palette.sage[channel]! +
            (palette.clay[channel]! - palette.sage[channel]!) * tint;
          const color =
            palette.base[channel]! + (pigment - palette.base[channel]!) * fold;
          data[offset + channel] =
            color + (palette.sheen[channel]! - color) * sheen + grain;
        }
        data[offset + 3] = 255;
      }
    }
    context!.putImageData(pixels, 0, 0);
  }

  function resize() {
    // Hidden tab panels have no size; retain their last frame until shown again.
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    const width = Math.ceil(canvas.clientWidth / 2.5);
    const height = Math.ceil(canvas.clientHeight / 2.5);
    if (pixels?.width === width && pixels.height === height) return;
    canvas.width = width;
    canvas.height = height;
    pixels = context!.createImageData(width, height);
    draw();
  }

  function animate(now: number) {
    frameId = requestAnimationFrame(animate);
    if (now - lastFrame < 1000 / 24) return;
    // Resume without a time jump after the card or browser tab was hidden.
    time += Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    draw();
  }

  function updatePlayback() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    if (!visible || document.hidden || reducedMotion.matches || !pixels) return;
    lastFrame = performance.now();
    frameId = requestAnimationFrame(animate);
  }

  resize();
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    updatePlayback();
  }).observe(canvas);
  reducedMotion.addEventListener('change', updatePlayback);
  // Also repaint the still frame when reduced motion or a hidden panel pauses playback.
  darkTheme.addEventListener('change', () => {
    if (pixels) draw();
  });
  document.addEventListener('visibilitychange', updatePlayback);
}
