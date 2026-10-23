/** Measure the stationary link so the rotated card cannot feed back into pointer coordinates. */
export function enhanceCardTilt(root: HTMLElement) {
  const surface = root.querySelector<HTMLElement>('[data-tilt-surface]');
  if (!surface) return;

  const enabled = matchMedia(
    '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
  );
  let frameId = 0;
  let pointerX = 0;
  let pointerY = 0;

  function render() {
    frameId = 0;
    const bounds = root.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.max(0, Math.min(1, (pointerX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1, (pointerY - bounds.top) / bounds.height));
    surface!.style.setProperty('--tilt-x', `${((0.5 - y) * 18).toFixed(2)}deg`);
    surface!.style.setProperty('--tilt-y', `${((x - 0.5) * 18).toFixed(2)}deg`);
  }

  function reset() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    surface!.style.removeProperty('--tilt-x');
    surface!.style.removeProperty('--tilt-y');
  }

  root.addEventListener('pointermove', (event) => {
    if (!enabled.matches || event.pointerType === 'touch') return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!frameId) frameId = requestAnimationFrame(render);
  });
  root.addEventListener('pointerleave', reset);
  root.addEventListener('pointercancel', reset);
  root.addEventListener('blur', reset);
  enabled.addEventListener('change', reset);
  document.addEventListener('visibilitychange', reset);
  window.addEventListener('blur', reset);
}
