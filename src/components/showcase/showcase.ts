import { enhanceGallery } from './gallery';

export function enhanceShowcase(root: HTMLElement) {
  const tablist = root.querySelector<HTMLElement>('[data-tabs]');
  if (!tablist) return;

  const panelsById = new Map(
    Array.from(root.querySelectorAll<HTMLElement>('[data-panel]'), (panel) => [
      `#${panel.id}`,
      panel,
    ]),
  );
  const pairs = Array.from(
    tablist.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'),
  ).flatMap((tab) => {
    const panel = panelsById.get(tab.hash);
    return panel ? [{ tab, panel }] : [];
  });
  const initial =
    pairs.find(({ tab }) => tab.hasAttribute('data-initial-tab')) ?? pairs[0];
  if (!initial) return;

  const gallery = root.querySelector<HTMLElement>('[data-gallery]');
  const restoreGallery = gallery && enhanceGallery(gallery);
  const galleryPanel = gallery?.closest('[data-panel]');

  function activate(target: (typeof pairs)[number], moveFocus = false) {
    if (
      moveFocus ||
      pairs.some(
        ({ panel }) =>
          panel !== target.panel && panel.contains(document.activeElement),
      )
    ) {
      target.tab.focus({ preventScroll: true });
    }
    for (const pair of pairs) {
      const selected = pair === target;
      pair.tab.setAttribute('aria-selected', String(selected));
      pair.tab.tabIndex = selected ? 0 : -1;
      pair.panel.hidden = !selected;
    }
    if (target.panel === galleryPanel) restoreGallery?.();
  }

  tablist.setAttribute('role', 'tablist');
  pairs.forEach((pair, index) => {
    const { tab, panel } = pair;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.tabIndex = 0;
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      activate(pair);
    });
    tab.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const next = {
        ArrowLeft: (index + pairs.length - 1) % pairs.length,
        ArrowRight: (index + 1) % pairs.length,
        Home: 0,
        End: pairs.length - 1,
        ' ': index,
        Enter: index,
      }[event.key];
      const target = next === undefined ? undefined : pairs[next];
      if (!target) return;

      event.preventDefault();
      activate(target, true);
    });
  });
  root.dataset.enhanced = '';
  activate(initial);
}
