const loader = new IntersectionObserver(
  (entries) => {
    for (const { isIntersecting, target } of entries) {
      if (!isIntersecting) continue;
      loader.unobserve(target);
      const holder = target as HTMLElement;
      const canvas = holder.querySelector<HTMLCanvasElement>(
        '[data-coastal-footer]',
      );
      if (!canvas) continue;
      void import('./coastal-world.js').then(({ enhanceCoastalFooter }) => {
        if (canvas.isConnected) enhanceCoastalFooter(holder, canvas);
      });
    }
  },
  { rootMargin: '240px' },
);

document
  .querySelectorAll<HTMLElement>('[data-coastal-scene]')
  .forEach((holder) => loader.observe(holder));
