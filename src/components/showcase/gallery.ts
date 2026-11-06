export function enhanceGallery(gallery: HTMLElement) {
  const items = Array.from(gallery.querySelectorAll('[data-work]'));
  const [first, second] = items;
  if (!first || !second) return;

  let position = Math.max(
    0,
    items.findIndex((item) => item.hasAttribute('data-initial-work')),
  );
  let step = 0;

  const measureStep = () =>
    second.getBoundingClientRect().left - first.getBoundingClientRect().left;

  function restorePosition() {
    if (!gallery.clientWidth) return;
    const nextStep = measureStep();
    if (!nextStep || nextStep === step) return;
    step = nextStep;
    gallery.scrollTo({ left: position * step, behavior: 'instant' });
  }

  gallery.addEventListener(
    'scroll',
    () => {
      // A resize can clamp or snap scrollLeft before ResizeObserver runs.
      if (step && gallery.clientWidth && step === measureStep()) {
        position = gallery.scrollLeft / step;
      }
    },
    { passive: true },
  );
  new ResizeObserver(restorePosition).observe(gallery);

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  gallery.addEventListener('keydown', (event) => {
    if (
      event.target !== gallery ||
      !step ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;

    const current = Math.round(gallery.scrollLeft / step);
    const next = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: items.length - 1,
    }[event.key];
    if (next === undefined) return;

    event.preventDefault();
    gallery.scrollTo({
      left: Math.max(0, Math.min(items.length - 1, next)) * step,
      behavior: reducedMotion.matches ? 'instant' : 'smooth',
    });
  });

  return () => {
    // Hiding the panel can reset scrollLeft even when its width stays the same.
    step = 0;
    restorePosition();
  };
}
