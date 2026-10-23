/** Progressive enhancement: the source document exposes both sections and real fragment links. */
export function enhanceShowcase(root: HTMLElement) {
  const tablist = root.querySelector<HTMLElement>('[data-tabs]');
  const tabs = Array.from(
    root.querySelectorAll<HTMLAnchorElement>('[data-tabs] a'),
  );
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-panel]'));
  const gallery = root.querySelector<HTMLElement>('[data-gallery]');
  const work = gallery?.querySelector<HTMLElement>('[data-work]');
  if (!tablist || tabs.length !== 2 || panels.length !== 2 || !gallery || !work)
    return;

  // Retain a fractional item position across tab hiding and viewport changes.
  let position = 1;
  let step = 0;
  function positionGallery() {
    if (!gallery || !work || !gallery.clientWidth) return;
    const nextStep =
      work.getBoundingClientRect().width +
      parseFloat(getComputedStyle(gallery).columnGap);
    if (nextStep === step) return;
    step = nextStep;
    gallery.scrollTo({ left: position * step, behavior: 'instant' });
  }
  gallery.addEventListener(
    'scroll',
    () => {
      // A resize can clamp/re-snap scrollLeft before ResizeObserver runs.
      // Do not replace the saved position using geometry from the previous size.
      const currentStep =
        work.getBoundingClientRect().width +
        parseFloat(getComputedStyle(gallery).columnGap);
      if (!panels[1]?.hidden && gallery.clientWidth && step === currentStep)
        position = gallery.scrollLeft / step;
    },
    { passive: true },
  );
  new ResizeObserver(positionGallery).observe(gallery);
  gallery.addEventListener('keydown', (event) => {
    if (
      event.target !== gallery ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    const count = gallery.querySelectorAll('[data-work]').length;
    const current = Math.round(gallery.scrollLeft / step);
    const next = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: count - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    gallery.scrollTo({
      left: Math.max(0, Math.min(count - 1, next)) * step,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  });

  function activate(index: number, moveFocus = false) {
    const target = tabs[index];
    if (!target) return;
    // Never leave focus in a panel that is about to be hidden.
    if (
      moveFocus ||
      panels.some(
        (panel, i) => i !== index && panel.contains(document.activeElement),
      )
    ) {
      target.focus({ preventScroll: true });
    }
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    panels.forEach((panel, i) => {
      panel.hidden = i !== index;
    });
    if (index === 1) {
      // display:none can reset scrollLeft. Restore before the visible panel paints.
      step = 0;
      positionGallery();
    }
  }

  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Projects and selected work');
  tabs.forEach((tab, index) => {
    const panel = panels[index];
    if (!panel) return;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.tabIndex = 0;
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      activate(index);
    });
    tab.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const next = {
        ArrowLeft: (index + tabs.length - 1) % tabs.length,
        ArrowRight: (index + 1) % tabs.length,
        Home: 0,
        End: tabs.length - 1,
        ' ': index,
        Enter: index,
      }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      activate(next, true);
    });
  });
  root.dataset.enhanced = '';
  activate(0);
}
