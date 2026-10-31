/** Load the renderer only when the shared footer approaches the viewport. */
const footers = document.querySelectorAll<HTMLCanvasElement>(
  '[data-coastal-footer]',
);

const loader = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      loader.unobserve(entry.target);
      const canvas = entry.target as HTMLCanvasElement;
      void import('./coastal-world.js').then(({ enhanceCoastalFooter }) => {
        if (canvas.isConnected) enhanceCoastalFooter(canvas);
      });
    }
  },
  { rootMargin: '240px' },
);

footers.forEach((canvas) => loader.observe(canvas));
