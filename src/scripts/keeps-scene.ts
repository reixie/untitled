export const keepsStage = {
  width: 300,
  height: 200,
  columns: 56,
  rows: 23,
  cellWidth: 4.8,
  cellHeight: 7.2,
  fontSize: 8,
  fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  left: 15.6,
  baseline: 23,
} as const;

export const keepsInks = ['frame', 'text', 'detail', 'accent'] as const;
export const keepsLoopMs = 12_000;
export const keepsStillMs = 8_500;

type Ink = (typeof keepsInks)[number];
type Cell = { glyph: string; ink: Ink };
type Grid = (Cell | undefined)[];

const { columns, rows } = keepsStage;
const tileWidth = 15;
const collectionRow = 11;
const transferStart = 2_000;
const transferDuration = 1_250;
const returnStart = 10_000;

const tiles = [
  {
    x: 19,
    y: 6,
    label: 'IMG / RIDGE',
    badge: '[I]',
    art: [
      ' .   *    .  ',
      '    /\\   .   ',
      ' . /::\\  /\\  ',
      ' _/;:::\\/##\\_',
      '~~~==~~~~==~~',
    ],
  },
  {
    x: 36,
    y: 6,
    label: 'GIF / ORBIT',
    badge: '[G]',
    art: ['    .---.    ', '  ./     \\.  ', ' (   (o)   ) ', '  \\.___.*./  '],
  },
  {
    x: 19,
    y: 15,
    label: 'MP4 / TIDE',
    badge: '[V]',
    art: [' ~=~~[>]~~=~ ', '  --o----    ', '  . : . .    '],
  },
  {
    x: 36,
    y: 14,
    label: 'URL / FIELD',
    badge: '[@]',
    art: ['  @  FIELD   ', '     NOTES   ', '  =========  ', '  -----   >  '],
  },
] as const;

function write(grid: Grid, x: number, y: number, text: string, ink: Ink) {
  for (const glyph of text) {
    grid[y * columns + x] = glyph === ' ' ? undefined : { glyph, ink };
    x++;
  }
}

function box(
  grid: Grid,
  x: number,
  y: number,
  width: number,
  height: number,
  ink: Ink,
) {
  const edge = `+${'-'.repeat(width - 2)}+`;
  write(grid, x, y, edge, ink);
  for (let row = y + 1; row < y + height - 1; row++) {
    write(grid, x, row, '|', ink);
    write(grid, x + width - 1, row, '|', ink);
  }
  write(grid, x, y + height - 1, edge, ink);
}

function scene(collection: boolean): Grid {
  const grid: Grid = Array(columns * rows).fill(undefined);
  box(grid, 0, 0, columns, rows, 'frame');
  write(grid, 0, 2, `+${'-'.repeat(columns - 2)}+`, 'frame');
  for (let row = 3; row < rows - 1; row++) write(grid, 16, row, '|', 'frame');
  write(grid, 16, rows - 1, '+', 'frame');
  write(grid, 2, 1, 'o o o', 'frame');
  write(grid, 25, 1, 'Keeps', 'text');
  write(
    grid,
    2,
    4,
    collection ? '= Library' : '> Library',
    collection ? 'text' : 'accent',
  );
  write(grid, 2, 6, '* Starred', 'text');
  write(grid, 2, 9, 'COLLECTIONS +', 'frame');
  write(
    grid,
    2,
    collectionRow,
    collection ? '> Inspiration' : '+ Inspiration',
    collection ? 'accent' : 'text',
  );
  write(
    grid,
    4,
    collectionRow + 1,
    collection ? '04 ITEMS' : '00 ITEMS',
    collection ? 'accent' : 'frame',
  );
  write(grid, 2, 19, '------------', 'frame');
  write(grid, 2, 21, 'On this Mac', 'frame');
  write(grid, 19, 4, collection ? 'Inspiration' : 'Library', 'text');
  write(grid, 43, 4, '[::]  04', 'frame');
  for (const tile of tiles) {
    box(grid, tile.x, tile.y, tileWidth, tile.art.length + 3, 'frame');
    tile.art.forEach((line, row) =>
      write(grid, tile.x + 1, tile.y + row + 1, line, 'detail'),
    );
    write(grid, tile.x + 2, tile.y + tile.art.length + 1, tile.label, 'text');
  }
  return grid;
}

const library = scene(false);
const collection = scene(true);

function transferFrame(phase: number): Grid {
  const progress = (phase - transferStart) / transferDuration;
  const index = Math.floor(progress);
  const step = progress - index;
  const tile = tiles[index]!;
  const grid = library.slice();
  const arrived = step >= 0.8;
  write(
    grid,
    4,
    collectionRow + 1,
    `0${index + Number(arrived)} ITEMS`,
    'accent',
  );
  box(grid, tile.x, tile.y, tileWidth, tile.art.length + 3, 'accent');
  if (arrived) {
    write(grid, 2, collectionRow, '+ Inspiration', 'accent');
  } else if (step >= 0.16) {
    const travel = (step - 0.16) / 0.64;
    const eased = travel * travel * (3 - 2 * travel);
    const x = Math.round(tile.x + 6 + (13 - tile.x - 6) * eased);
    const y = Math.round(
      tile.y +
        1 +
        (collectionRow - tile.y - 1) * eased -
        3 * Math.sin(Math.PI * travel),
    );
    write(grid, x + 4, y, ': .', 'frame');
    write(grid, x, y, tile.badge, 'accent');
  }
  return grid;
}

function glyphRuns(grid: Grid) {
  const runs: { x: number; y: number; text: string; ink: Ink }[] = [];
  for (let y = 0; y < rows; y++) {
    let previous: (typeof runs)[number] | undefined;
    for (let x = 0; x < columns; x++) {
      const cell = grid[y * columns + x];
      if (!cell) {
        previous = undefined;
      } else if (previous?.ink === cell.ink) {
        previous.text += cell.glyph;
      } else {
        previous = { x, y, text: cell.glyph, ink: cell.ink };
        runs.push(previous);
      }
    }
  }
  return runs;
}

const libraryRuns = glyphRuns(library);
const collectionRuns = glyphRuns(collection);

export function keepsFrame(elapsed: number) {
  const phase = elapsed % keepsLoopMs;
  if (phase < transferStart) return libraryRuns;
  if (phase < transferStart + transferDuration * tiles.length) {
    return glyphRuns(transferFrame(phase));
  }
  if (phase < returnStart) return collectionRuns;

  // A fixed reveal order dissolves the changed characters back into Library.
  const reveal = (phase - returnStart) / 1_850;
  if (reveal >= 1) return libraryRuns;
  return glyphRuns(
    collection.map((cell, i) =>
      (Math.imul(i + 1, 0x9e3779b1) >>> 0) / 2 ** 32 < reveal
        ? library[i]
        : cell,
    ),
  );
}
