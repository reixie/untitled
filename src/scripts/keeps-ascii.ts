import {
  keepsFrame,
  keepsInkProperties,
  keepsStage,
  keepsStillFrame,
} from './keeps-scene';

export function enhanceKeepsAscii(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const ctx = context;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const theme = matchMedia('(prefers-color-scheme: dark)');
  const {
    width,
    height,
    left,
    baseline,
    cellWidth,
    cellHeight,
    fontSize,
    fontFamily,
  } = keepsStage;
  const font = `${fontSize}px ${fontFamily}`;
  ctx.font = font;
  const glyphWidth = ctx.measureText('M').width;
  let palette = readPalette();
  let visible = false;
  let frameId = 0;
  let elapsed = 0;
  let resumeElapsed = 0;
  let startTime: number | undefined;
  let lastFrame = -1;
  let drawn: ReturnType<typeof keepsFrame> | undefined;

  function readPalette() {
    const style = getComputedStyle(canvas);
    return Object.fromEntries(
      Object.entries(keepsInkProperties).map(([ink, property]) => [
        ink,
        style.getPropertyValue(property).trim(),
      ]),
    );
  }

  function draw(runs: ReturnType<typeof keepsFrame>, repaint = false) {
    if (!repaint && runs === drawn) return;
    drawn = runs;
    const scale = Math.min(canvas.width / width, canvas.height / height);
    ctx.resetTransform();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(
      (scale * cellWidth) / glyphWidth,
      0,
      0,
      scale,
      (canvas.width - width * scale) / 2 + left * scale,
      (canvas.height - height * scale) / 2,
    );
    ctx.font = font;
    for (const { x, y, text, ink } of runs) {
      ctx.fillStyle = palette[ink]!;
      ctx.fillText(text, x * glyphWidth, baseline + y * cellHeight);
    }
  }

  function render() {
    const { clientWidth, clientHeight } = canvas;
    if (!clientWidth || !clientHeight) return;
    const ratio = Math.min(devicePixelRatio, 2);
    const pixelWidth = Math.round(clientWidth * ratio);
    const pixelHeight = Math.round(clientHeight * ratio);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    draw(motion.matches ? keepsStillFrame : keepsFrame(elapsed), true);
    canvas.dataset.ready ??= '';
  }

  function animate(now: number) {
    frameId = 0;
    if (document.hidden || !canvas.clientWidth) return;
    startTime ??= now;
    const sinceResume = now - startTime;
    const frame = Math.floor((sinceResume * 24) / 1000);
    if (frame !== lastFrame) {
      lastFrame = frame;
      elapsed = resumeElapsed + sinceResume;
      draw(keepsFrame(elapsed));
    }
    frameId = requestAnimationFrame(animate);
  }

  function syncPlayback() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    if (!visible || document.hidden || !canvas.clientWidth) return;
    render();
    if (motion.matches) return;
    resumeElapsed = elapsed;
    startTime = undefined;
    lastFrame = -1;
    frameId = requestAnimationFrame(animate);
  }

  new ResizeObserver(() => {
    if (visible && !document.hidden) render();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    syncPlayback();
  }).observe(canvas);
  motion.addEventListener('change', syncPlayback);
  theme.addEventListener('change', () => {
    palette = readPalette();
    if (visible && !document.hidden) render();
  });
  document.addEventListener('visibilitychange', syncPlayback);
}
