/* global document, matchMedia, getComputedStyle, performance, IntersectionObserver,
   ResizeObserver, requestAnimationFrame, cancelAnimationFrame, devicePixelRatio */
import { createCoastalScene } from './coastal-scene.js';

const stillTime = 3.1;
const frameInterval = 1000 / 30 - 0.4;

export function enhanceCoastalFooter(holder, canvas) {
  const theme = matchMedia('(prefers-color-scheme: dark)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const colorScheme = () => (theme.matches ? 'dark' : 'light');
  const background = () =>
    getComputedStyle(holder).getPropertyValue('--color-background-1').trim();
  const scene = createCoastalScene(canvas, colorScheme(), background());
  if (!scene) return;

  let animation = 0;
  let visible = false;
  let userPaused = false;
  let motionOverride = false;
  let lastTick = 0;
  let elapsed = 0;
  let clockStart = 0;

  function timeNow(now = performance.now()) {
    return elapsed + (animation ? (now - clockStart) / 1000 : 0);
  }

  function canAnimate() {
    return !reduced.matches || motionOverride;
  }

  function repaint() {
    scene.paint(canAnimate() ? timeNow() : stillTime);
  }

  function tick(now) {
    animation = requestAnimationFrame(tick);
    if (now - lastTick < frameInterval) return;
    lastTick = now;
    scene.paint(timeNow(now));
  }

  function syncPlayback() {
    const shouldPlay =
      !userPaused && canAnimate() && visible && !document.hidden;
    if (shouldPlay === Boolean(animation)) return;

    if (shouldPlay) {
      clockStart = performance.now();
      lastTick = 0;
      animation = requestAnimationFrame(tick);
    } else {
      elapsed = timeNow();
      cancelAnimationFrame(animation);
      animation = 0;
    }
    updateDescription();
  }

  function updateDescription() {
    canvas.setAttribute(
      'aria-description',
      animation
        ? 'Animated coast. Press Space to pause.'
        : 'Still coast. Press Space to play.',
    );
  }

  function resize() {
    const { width, height } = holder.getBoundingClientRect();
    const narrow =
      getComputedStyle(holder).getPropertyValue('--coastal-layout').trim() ===
      'narrow';
    if (
      !scene.resize(width, height, Math.min(devicePixelRatio || 1, 2), narrow)
    )
      return;
    repaint();
    holder.dataset.ready = 'true';
  }

  function applyTheme() {
    const scheme = colorScheme();
    holder.dataset.theme = scheme;
    if (scene.setTheme(scheme, background())) repaint();
  }

  canvas.addEventListener('keydown', (event) => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    if (!canAnimate()) {
      motionOverride = true;
      userPaused = false;
    } else {
      userPaused = !userPaused;
    }
    syncPlayback();
  });
  reduced.addEventListener('change', () => {
    motionOverride = false;
    syncPlayback();
    if (reduced.matches) repaint();
  });
  theme.addEventListener('change', applyTheme);
  document.addEventListener('visibilitychange', syncPlayback);
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      syncPlayback();
    },
    { rootMargin: '80px' },
  ).observe(holder);
  new ResizeObserver(resize).observe(holder);

  holder.dataset.theme = colorScheme();
  updateDescription();
  resize();
}
