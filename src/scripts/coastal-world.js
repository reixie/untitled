/* global document, matchMedia, getComputedStyle, performance, AbortController,
   MutationObserver, IntersectionObserver, ResizeObserver, requestAnimationFrame,
   cancelAnimationFrame, devicePixelRatio */

/**
 * The coastal ASCII renderer. All geometry is sampled into one character grid.
 * Every moving field is a pure, periodic function of a 24.5-second phase.
 * Static masks and glyphs are cached; the animation does not read canvas pixels.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {() => void} Disconnect observers and stop playback.
 */
export function enhanceCoastalFooter(canvas) {
  /*
   * ON THE HORIZON
   * One world, one character grid. No vector shapes reach the visible canvas.
   * Geometry is sampled at 3 × 3 per cell; material and coverage choose a glyph.
   * Time is absolute and periodic. Every frequency is an integer multiple of
   * 2π / 24.5; there are no integrated positions, random frames or trail buffers.
   * Source reference: the supplied Hawaiian lagoon HTML (1944 × 1760).
   * Retained: supersampled coverage, cached static material, seeded detail and
   * harmonic time. Replaced: colored cell rectangles, full-frame readbacks,
   * time-bucket flicker, top-down poses, blur passes and fixed-stage scaling.
   */
  const PERIOD = 24.5,
    TAU = Math.PI * 2,
    SS = 3;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return () => {};
  const holder = canvas.parentElement;
  if (!holder) return () => {};
  const events = new AbortController();
  const listenerOptions = { signal: events.signal };
  let disposed = false;
  const themePreference = matchMedia('(prefers-color-scheme: dark)');
  let motionOverride = false,
    theme = 'dark',
    background = '#080f1c';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const GLYPHS = ' .,:;-~=+*ox%#@/\\|_()^<>!';
  const GI = Object.fromEntries(Array.from(GLYPHS, (c, i) => [c, i]));
  // Deliberate, quantized materials. Color is cached in the atlas, never made per frame.
  const DARK_COLORS = [
    '#152337',
    '#1c3045',
    '#294259',
    '#36566e',
    '#426a82',
    '#528397',
    '#699eab',
    '#86b5bb',
    '#a9ccca',
    '#c3dcd3',
    '#253640',
    '#394b54',
    '#53666d',
    '#718188',
    '#94a09f',
    '#b0bbb4',
    '#d4d6c4',
    '#dfd3b1',
    '#e6c797',
    '#f0d8a9',
    '#332f2c',
    '#4c3e30',
    '#69533a',
    '#89704b',
    '#a68b5b',
    '#c4a76f',
    '#e1c086',
    '#f6dda7',
    '#d5be91',
    '#b5aa8b',
    '#244350',
    '#3a6570',
    '#548a94',
    '#78adb1',
    '#9ac9c7',
    '#304452',
    '#6f8a9b',
    '#8ea8b6',
    '#bdcbd0',
  ];
  const LIGHT_COLORS = [
    '#d3dddb',
    '#bdcece',
    '#9db6bc',
    '#7e9ea9',
    '#668b9b',
    '#557f90',
    '#416d80',
    '#315e73',
    '#254c62',
    '#193c50',
    '#c2c7be',
    '#a3afa9',
    '#7e9291',
    '#657e82',
    '#4d6c75',
    '#49636b',
    '#354c56',
    '#334747',
    '#626450',
    '#796b49',
    '#e6dcc9',
    '#d8c7a8',
    '#c9b185',
    '#bc9a63',
    '#ad8446',
    '#a07332',
    '#986228',
    '#b5792b',
    '#a38a57',
    '#8f8264',
    '#b7cfcb',
    '#8eafaf',
    '#6e969e',
    '#4e7887',
    '#365e71',
    '#d6dcd7',
    '#7e959c',
    '#5e7e88',
    '#3c5e6c',
  ];
  let COLORS = DARK_COLORS;
  const SEA = 30,
    ROCK = 10,
    LIGHT = 20;
  const SCHOOL_OFFSETS = [-110, 0, -40, -34, -35, 32, 38, -10, 110, 24];
  const smooth = (a, b, x) => {
    x = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };
  const mod = (x, n) => ((x % n) + n) % n;
  const noise = (x, y, s = 0) => {
    let n = Math.imul(x + 117 + s, 374761393) ^ Math.imul(y + 313, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const makeCanvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  let W = 1944,
    H = 760,
    cols = 0,
    rows = 0,
    cw = 0,
    ch = 0,
    tw = 0,
    th = 0,
    horizon = 0,
    lx = 0,
    ly = 0,
    base = 0;
  let sky, land, atlas, mask, mc, landMat, landCoverage, seaStart;
  let waterX,
    waterY,
    waterNoise,
    waterPhase,
    waterDepth,
    waterIndex,
    creatureVisited,
    creatureStamp = 0;
  let sprites = {},
    animation = 0,
    visible = true,
    userPaused = false,
    lastTick = 0,
    elapsed = 0,
    clockStart = performance.now();
  function resolveTheme() {
    const root = document.documentElement,
      explicit = root.dataset.theme;
    if (explicit === 'light' || explicit === 'dark') return explicit;
    if (root.classList.contains('light')) return 'light';
    if (root.classList.contains('dark')) return 'dark';
    return themePreference.matches ? 'dark' : 'light';
  }
  function applyTheme() {
    theme = resolveTheme();
    COLORS = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
    background =
      getComputedStyle(holder)
        .getPropertyValue('--color-background-1')
        .trim() || (theme === 'dark' ? '#000' : '#fff');
    holder.dataset.theme = theme;
    if (!cols) return;
    buildAtlas();
    buildStatic();
    paint(reduced.matches && !motionOverride ? 3.1 : timeNow());
  }
  function field(x, y, seed = 0) {
    const ix = Math.floor(x),
      iy = Math.floor(y),
      fx = x - ix,
      fy = y - iy;
    const u = fx * fx * (3 - 2 * fx),
      v = fy * fy * (3 - 2 * fy);
    const a = noise(ix, iy, seed),
      b = noise(ix + 1, iy, seed),
      c = noise(ix, iy + 1, seed),
      d = noise(ix + 1, iy + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function glyph(ctx, c, r, g, color, alpha = 1) {
    if (!g || c < 0 || r < 0 || c >= cols || r >= rows) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(atlas, g * tw, color * th, tw, th, c * tw, r * th, tw, th);
  }
  function path(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++)
      ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fill();
  }
  function buildAtlas() {
    atlas = makeCanvas(GLYPHS.length * tw, COLORS.length * th);
    const a = atlas.getContext('2d');
    a.textAlign = 'center';
    a.textBaseline = 'middle';
    a.font = `${Math.floor(th * 0.87)}px "SFMono-Regular", Consolas, "Liberation Mono", monospace`;
    for (let p = 0; p < COLORS.length; p++) {
      a.fillStyle = COLORS[p];
      for (let g = 1; g < GLYPHS.length; g++)
        a.fillText(GLYPHS[g], (g + 0.5) * tw, (p + 0.48) * th);
    }
  }
  function stamp(material, draw) {
    mc.setTransform(1, 0, 0, 1, 0, 0);
    mc.clearRect(0, 0, mask.width, mask.height);
    mc.setTransform(SS / cw, 0, 0, SS / ch, 0, 0);
    mc.fillStyle = '#fff';
    mc.strokeStyle = '#fff';
    draw(mc);
    const data = mc.getImageData(0, 0, mask.width, mask.height).data;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        let sum = 0;
        for (let sy = 0; sy < SS; sy++)
          for (let sx = 0; sx < SS; sx++)
            sum += data[((r * SS + sy) * mask.width + c * SS + sx) * 4 + 3];
        const coverage = sum / (255 * SS * SS),
          i = r * cols + c;
        if (coverage > 0.18) {
          landMat[i] = material;
          landCoverage[i] = coverage;
        }
      }
  }
  function buildStatic() {
    sky = makeCanvas(canvas.width, canvas.height);
    land = makeCanvas(canvas.width, canvas.height);
    const s = sky.getContext('2d'),
      l = land.getContext('2d');
    s.fillStyle = background;
    s.fillRect(0, 0, sky.width, sky.height);
    landMat = new Uint8Array(cols * rows);
    landCoverage = new Float32Array(cols * rows);
    creatureVisited = new Uint32Array(cols * rows);
    creatureStamp = 0;
    mask = makeCanvas(cols * SS, rows * SS);
    mc = mask.getContext('2d', { willReadFrequently: true });
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * cw,
          y = (r + 0.5) * ch,
          n = noise(c, r),
          fog = Math.exp(-Math.pow((y - horizon + 25) / 95, 2));
        if (y < horizon && n < 0.04 + fog * 0.46) {
          glyph(s, c, r, n > 0.78 ? GI[','] : GI['.'], fog > 0.6 ? 2 : 0, 0.75);
        }
        // Thin, wind-stretched cloud banks, described entirely by character density.
        if (y < horizon - 40) {
          const cloud =
            field(x * 0.004, y * 0.019, 9) * 0.72 +
            field(x * 0.011, y * 0.037, 4) * 0.28;
          const bank = Math.exp(-Math.pow((y - horizon + 165) / 110, 2));
          if (cloud > 0.56 && n < bank * (cloud - 0.5) * 1.6)
            glyph(s, c, r, GI[n > 0.08 ? '-' : ','], 35, 0.42);
        }
        if (theme === 'dark' && y < ly - 35 && n > 0.998)
          glyph(s, c, r, GI[n > 0.9995 ? '+' : '.'], 36, 0.6);
      }
    // Low, haze-eroded headlands flatten the horizon and establish great distance.
    stamp(1, (c) =>
      path(c, [
        [0, horizon + 2],
        [W * 0.08, horizon - 7],
        [W * 0.14, horizon - 19],
        [W * 0.19, horizon - 12],
        [W * 0.24, horizon - 25],
        [W * 0.3, horizon - 6],
        [W * 0.36, horizon - 8],
        [W * 0.42, horizon - 18],
        [W * 0.48, horizon - 12],
        [W * 0.54, horizon - 29],
        [W * 0.6, horizon - 16],
        [W * 0.69, horizon - 12],
        [W * 0.75, horizon + 9],
      ]),
    );
    // Foreground headland: a walkable ridge, fractured face and a submerged shelf.
    stamp(2, (c) =>
      path(c, [
        [W * 0.755, base + 40],
        [W * 0.785, base + 12],
        [W * 0.82, base - 4],
        [W * 0.875, base - 9],
        [W * 0.906, base - 28],
        [W * 0.95, base - 19],
        [W, base - 32],
        [W, H],
        [W * 0.86, H],
        [W * 0.852, horizon + 193],
        [W * 0.826, horizon + 162],
        [W * 0.817, horizon + 122],
        [W * 0.783, horizon + 94],
        [W * 0.79, horizon + 60],
      ]),
    );
    stamp(3, (c) =>
      path(c, [
        [W * 0.7, horizon + 212],
        [W * 0.74, horizon + 191],
        [W * 0.77, horizon + 197],
        [W * 0.8, horizon + 169],
        [W * 0.84, horizon + 187],
        [W * 0.91, horizon + 221],
        [W, H],
        [W * 0.8, H],
        [W * 0.76, horizon + 275],
        [W * 0.72, horizon + 256],
      ]),
    );
    stamp(11, (c) => {
      for (let k = 0; k < 6; k++) {
        const x = W * 0.788 + (k - 2) * 25,
          y = horizon + 109 + k * 9,
          rx = 18 + noise(k, 6) * 16,
          ry = 11 + noise(k, 7) * 14;
        c.beginPath();
        c.ellipse(x, y, rx, ry, -0.25, 0, TAU);
        c.fill();
      }
    });
    // Tower dimensions stay in world units, rather than stretching into a crop.
    stamp(4, (c) =>
      path(c, [
        [lx - 54, base],
        [lx - 37, ly + 35],
        [lx + 35, ly + 35],
        [lx + 53, base],
      ]),
    );
    stamp(5, (c) =>
      path(c, [
        [lx + 11, ly + 35],
        [lx + 35, ly + 35],
        [lx + 53, base],
        [lx + 17, base],
      ]),
    );
    stamp(6, (c) => {
      c.fillRect(lx - 54, ly + 22, 108, 13);
      c.fillRect(lx - 46, ly - 28, 92, 9);
      path(c, [
        [lx - 49, ly - 28],
        [lx, ly - 66],
        [lx + 49, ly - 28],
      ]);
      c.fillRect(lx - 3, ly - 78, 6, 16);
    });
    stamp(7, (c) => c.fillRect(lx - 36, ly - 18, 72, 38));
    stamp(6, (c) => {
      c.fillRect(lx - 40, ly - 20, 6, 42);
      c.fillRect(lx + 33, ly - 20, 6, 42);
      c.fillRect(lx - 3, ly - 20, 6, 42);
      c.fillRect(lx - 61, ly + 16, 122, 4);
      for (let x = -58; x < 62; x += 19) c.fillRect(lx + x, ly + 9, 3, 13);
    });
    stamp(9, (c) => {
      for (const y of [ly + 73, ly + 133]) {
        c.beginPath();
        c.arc(lx - 1, y, 8, Math.PI, 0);
        c.lineTo(lx + 7, y + 18);
        c.lineTo(lx - 9, y + 18);
        c.fill();
      }
      c.beginPath();
      c.arc(lx - 1, base - 29, 11, Math.PI, 0);
      c.lineTo(lx + 10, base);
      c.lineTo(lx - 12, base);
      c.fill();
    });
    stamp(10, (c) => {
      c.fillRect(lx - 43, ly + 36, 86, 5);
      c.fillRect(lx - 46, ly + 45, 92, 4);
      c.fillRect(lx - 57, base - 5, 114, 6);
      c.fillRect(lx - 60, base + 4, 120, 5);
    });
    // The keeper's hut belongs to the cliff, below and behind the tower.
    stamp(8, (c) => {
      c.fillRect(lx + 77, base - 36, 73, 36);
      path(c, [
        [lx + 67, base - 36],
        [lx + 110, base - 65],
        [lx + 159, base - 36],
      ]);
    });
    stamp(7, (c) => c.fillRect(lx + 102, base - 27, 13, 14));
    stamp(6, (c) => c.fillRect(lx + 134, base - 66, 8, 22));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c,
          m = landMat[i];
        if (!m || m === 1) continue;
        const x = (c + 0.5) * cw,
          y = (r + 0.5) * ch,
          n = noise(c, r, 31),
          cover = landCoverage[i];
        let g = GI['.'],
          p = 2;
        if (m === 1) {
          g = n < 0.55 ? GI[':'] : GI['-'];
          p = 2;
        }
        if (m === 2 || m === 3) {
          // Oblique strata and vertical faults, seeded once. These are rock, not snow.
          const grain =
            field(x * 0.016, y * 0.017, 3) * 0.7 +
            field(x * 0.043, y * 0.037, 8) * 0.3;
          const strata =
            Math.sin(x * 0.014 + y * 0.055 + (grain - 0.5) * 5) +
            0.4 * Math.sin(x * 0.039 - y * 0.026);
          const fault = Math.sin(x * 0.052 + y * 0.012 + grain * 7);
          p =
            (m === 3 ? SEA : ROCK) +
            Math.max(
              0,
              Math.min(m === 3 ? 2 : 4, Math.floor((strata + 1.7) * 1.1)),
            );
          g = (strata > 0.55 ? '%#+' : strata > -0.6 ? '=+:' : ';:.,')[
            Math.floor(n * 3)
          ];
          g = GI[g];
          if (fault > 0.92 && n > 0.38) {
            g = GI[n > 0.7 ? '/' : ':'];
            p = m === 3 ? 31 : 11;
          }
          if (y < base + 28 && m === 2) {
            p = 14;
            g = GI[n > 0.5 ? '=' : '+'];
          }
          if (m === 2 && y > horizon + 50 && grain > 0.58) {
            g = GI[n > 0.65 ? '%' : ':'];
            p = 11;
          }
        }
        if (m === 4) {
          const course = Math.floor((y - ly - 35) / 19),
            mortar = mod(y - ly - 35, 19) < 3.5;
          g =
            GI[
              mortar
                ? '-'
                : mod(x - lx + (course % 2) * 15, 30) < 3
                  ? '|'
                  : n > 0.65
                    ? '#'
                    : n > 0.3
                      ? '='
                      : '+'
            ];
          p = 15 + (x < lx - 14 ? 1 : 0);
          if (Math.sin(y * 0.048) > 0.68) p = 12;
        }
        if (m === 5) {
          g = GI[n > 0.5 ? ':' : '='];
          p = 12;
          if (Math.sin(y * 0.048) > 0.68) p = 10;
        }
        if (m === 6) {
          g =
            GI[
              y < ly - 20
                ? Math.abs(x - lx) < 6
                  ? '^'
                  : n > 0.55
                    ? '#'
                    : '='
                : '='
            ];
          p = y < ly - 20 ? 13 : 11;
        }
        if (m === 7) {
          g = GI[n > 0.4 ? '*' : '+'];
          p = 26;
        }
        if (m === 8) {
          g = GI[n > 0.5 ? '+' : '#'];
          p = 13;
        }
        if (m === 9) {
          g = GI[Math.abs(x - lx) < 4 ? '|' : ':'];
          p = 1;
        }
        if (m === 10) {
          g = GI['='];
          p = 16;
        }
        if (m === 11) {
          g = GI[n > 0.7 ? '#' : n > 0.35 ? '%' : ':'];
          p = 11 + Math.floor(n * 3);
        }
        if (cover < 0.48) g = GI[':'];
        glyph(
          l,
          c,
          r,
          g,
          p,
          Math.min(1, cover * 1.55) * (1 - smooth(H - 100, H, y) * 0.65),
        );
      }
    // Ocean below the nominal horizon is recomputed, the distant mountains are cached in sky.
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (landMat[r * cols + c] === 1) {
          glyph(s, c, r, GI[noise(c, r) > 0.5 ? ':' : '-'], 2);
          landMat[r * cols + c] = 0;
        }
  }
  function buildWater() {
    seaStart = Math.max(0, Math.floor(horizon / ch) - 1);
    const count = (rows - seaStart) * cols;
    waterX = new Float32Array(count);
    waterY = new Float32Array(count);
    waterNoise = new Float32Array(count);
    waterPhase = new Float32Array(count);
    waterDepth = new Float32Array(count);
    waterIndex = new Uint32Array(count);
    let i = 0;
    for (let r = seaStart; r < rows; r++)
      for (let c = 0; c < cols; c++, i++) {
        const x = (c + 0.5) * cw,
          y = (r + 0.5) * ch,
          d = Math.max(0, (y - horizon) / (H - horizon));
        waterX[i] = x;
        waterY[i] = y;
        waterNoise[i] = noise(c, r, 7);
        waterDepth[i] = d;
        // Log compression packs short, slower crests toward the horizon.
        waterPhase[i] = Math.log(1 + (y - horizon) * 0.036) * 19 + x * 0.013;
        waterIndex[i] = r * cols + c;
      }
  }
  function buildSprite(type, pose, scale = 1) {
    const width =
      (type === 'whale'
        ? 250
        : type === 'dolphin'
          ? 151
          : type === 'bird'
            ? 82
            : type === 'fish'
              ? 51
              : 64) * scale;
    const height =
      (type === 'whale'
        ? 119
        : type === 'dolphin'
          ? 94
          : type === 'bird'
            ? 53
            : type === 'fish'
              ? 41
              : 111) * scale;
    const nc = Math.ceil(width / cw) + 2,
      nr = Math.ceil(height / ch) + 2;
    const c = makeCanvas(nc * SS, nr * SS),
      q = c.getContext('2d', { willReadFrequently: true });
    q.setTransform(SS / cw, 0, 0, SS / ch, (nc * SS) / 2, (nr * SS) / 2);
    q.scale(scale, scale);
    q.fillStyle = '#fff';
    q.strokeStyle = '#fff';
    const bend = Math.sin((pose * TAU) / 24);
    if (type === 'whale') {
      q.beginPath();
      q.moveTo(-111, -4);
      q.bezierCurveTo(-117, -28, -80, -39, -38, -31);
      q.lineTo(-14, -32);
      q.quadraticCurveTo(2, -57, 7, -28);
      q.bezierCurveTo(40, -23, 64, -7, 83, -4);
      q.lineTo(112, -26 + bend * 7);
      q.lineTo(103, -3 + bend * 4);
      q.lineTo(118, 20 + bend * 7);
      q.lineTo(83, 8);
      q.bezierCurveTo(53, 18, 16, 30, -27, 24);
      q.quadraticCurveTo(-25, 59, -52, 23);
      q.bezierCurveTo(-87, 22, -111, 14, -111, -4);
      q.fill();
      // A small eye and ventral line survive quantization at desktop sizes.
      q.globalCompositeOperation = 'destination-out';
      q.fillRect(-91, -7, 6, 5);
      q.globalCompositeOperation = 'source-over';
    } else if (type === 'dolphin') {
      q.rotate(bend * 0.07);
      q.beginPath();
      q.moveTo(-51, 0);
      q.bezierCurveTo(-32, -7, -19, -22, 5, -17);
      q.quadraticCurveTo(9, -39, 20, -16);
      q.bezierCurveTo(33, -14, 38, -7, 50, -5);
      q.lineTo(67, -1);
      q.lineTo(49, 5);
      q.bezierCurveTo(29, 16, 12, 18, -4, 11);
      q.lineTo(-14, 32);
      q.lineTo(-22, 12);
      q.lineTo(-49, 5);
      q.lineTo(-69, 20 + bend * 5);
      q.lineTo(-61, 1);
      q.lineTo(-70, -16 + bend * 5);
      q.closePath();
      q.fill();
    } else if (type === 'bird') {
      const wing = -12 - bend * 10;
      q.lineWidth = 5;
      q.lineCap = 'round';
      q.beginPath();
      q.moveTo(-35, wing + 3);
      q.quadraticCurveTo(-17, -20, 0, 4);
      q.quadraticCurveTo(16, -18, 35, wing);
      q.stroke();
      q.fillRect(-3, 0, 7, 9);
    } else if (type === 'fish') {
      q.beginPath();
      q.ellipse(1, 0, 17, 8, 0, 0, TAU);
      q.fill();
      path(q, [
        [-11, 0],
        [-25, -11 + bend * 3],
        [-23, 11 + bend * 3],
      ]);
      path(q, [
        [0, -5],
        [3, -15],
        [9, -5],
      ]);
    } else {
      q.beginPath();
      q.ellipse(0, -24, 21 + 2 * bend, 17 - 2 * bend, 0, Math.PI, TAU);
      q.lineTo(23, -18);
      q.quadraticCurveTo(0, -9, -23, -18);
      q.fill();
      q.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const x = -15 + i * 10;
        q.beginPath();
        q.moveTo(x, -17);
        q.bezierCurveTo(
          x + 11 * bend,
          0,
          x - 8 * bend,
          18,
          x + 5 * bend,
          35 - i * 2,
        );
        q.stroke();
      }
    }
    const data = q.getImageData(0, 0, c.width, c.height).data,
      cells = [];
    for (let r = 0; r < nr; r++)
      for (let col = 0; col < nc; col++) {
        let sum = 0;
        for (let yy = 0; yy < SS; yy++)
          for (let xx = 0; xx < SS; xx++)
            sum += data[((r * SS + yy) * c.width + col * SS + xx) * 4 + 3];
        const a = sum / (255 * SS * SS);
        if (a > 0.13) {
          const interior =
            type === 'whale'
              ? r % 3 === 0
                ? '='
                : '%'
              : type === 'dolphin'
                ? r > nr * 0.55
                  ? '='
                  : '#'
                : type === 'jelly'
                  ? r < nr * 0.4
                    ? '('
                    : ':'
                  : '#';
          cells.push(
            col - Math.floor(nc / 2),
            r - Math.floor(nr / 2),
            a > 0.7 ? GI[interior] : a > 0.4 ? GI['+'] : GI[':'],
            a,
          );
        }
      }
    return cells;
  }
  function buildSprites() {
    sprites = {};
    for (const type of ['whale', 'dolphin', 'bird', 'fish', 'jelly']) {
      const frames = [];
      for (let p = 0; p < 24; p++)
        frames.push(
          buildSprite(
            type,
            p,
            type === 'fish' ? 1.35 : type === 'whale' ? 1.15 : 1,
          ),
        );
      sprites[type] = frames;
    }
  }
  function creature(
    type,
    x,
    y,
    pose,
    color,
    alpha = 1,
    flip = false,
    yaw = 1,
    pitch = 0,
  ) {
    const cells = sprites[type][mod(Math.floor(pose * 24), 24)];
    const c = Math.round(x / cw),
      r = Math.round(y / ch),
      cp = Math.cos(pitch),
      sp = Math.sin(pitch);
    creatureStamp++;
    if (creatureStamp === 4294967295) {
      creatureVisited.fill(0);
      creatureStamp = 1;
    }
    for (let i = 0; i < cells.length; i += 4) {
      const dx = cells[i] * cw * yaw * (flip ? -1 : 1),
        dy = cells[i + 1] * ch;
      const cc = c + Math.round((dx * cp - dy * sp) / cw),
        rr = r + Math.round((dx * sp + dy * cp) / ch);
      if (
        cc < 0 ||
        rr < 0 ||
        cc >= cols ||
        rr >= rows ||
        landMat[rr * cols + cc] > 1
      )
        continue;
      const index = rr * cols + cc;
      if (creatureVisited[index] === creatureStamp) continue;
      creatureVisited[index] = creatureStamp;
      const shade =
        (type === 'whale' || type === 'dolphin') && dy < -3
          ? Math.max(color >= SEA ? SEA : 0, color - 1)
          : color;
      glyph(
        context,
        cc,
        rr,
        cells[i + 2],
        shade,
        alpha * Math.min(1, cells[i + 3] * 1.7),
      );
    }
  }
  function beamAt(x, y, cs, sn) {
    const dx = x - lx,
      distance = Math.abs(dx),
      reach = 1920 * Math.abs(cs);
    if (dx * cs >= 0 || distance > reach || reach < 1) return 0;
    const center = ly + distance * (0.065 + 0.09 * sn),
      spread = 12 + distance * (0.035 + 0.018 * Math.abs(sn));
    const edge = Math.max(0, 1 - Math.abs(y - center) / spread);
    return edge * edge * (1 - distance / reach) * Math.abs(cs);
  }
  function paint(seconds) {
    const p = mod(seconds, PERIOD) / PERIOD,
      t = p * TAU,
      cs = Math.cos(t + 0.45),
      sn = Math.sin(t + 0.45);
    context.globalAlpha = 1;
    context.drawImage(sky, 0, 0);
    // One projected horizontal cone. During the far half-turn it naturally exits right.
    for (
      let r = Math.max(0, Math.floor((ly - 130) / ch));
      r < Math.ceil(horizon / ch);
      r++
    )
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * cw,
          y = (r + 0.5) * ch,
          b = beamAt(x, y, cs, sn);
        if (b < 0.018) continue;
        const n = noise(c, r, 12);
        if (n > b * 0.8 + 0.13) continue;
        glyph(
          context,
          c,
          r,
          GI[b > 0.3 ? '-' : n > 0.25 ? ':' : '.'],
          LIGHT + 2 + Math.min(5, Math.floor(b * 8)),
          0.9,
        );
      }
    for (let i = 0; i < waterX.length; i++) {
      const x = waterX[i],
        y = waterY[i],
        d = waterDepth[i],
        n = waterNoise[i],
        index = waterIndex[i];
      if (landMat[index] > 1 || y < horizon + Math.sin(x * 0.01 + t * 2) * 2)
        continue;
      const phase =
        waterPhase[i] +
        Math.sin(x * 0.011 + t * 2) * 0.7 +
        Math.sin(y * 0.027 - t) * 0.35;
      const swell = Math.sin(phase - t * 3 + Math.sin(x * 0.004 + t) * 0.7);
      const cross = Math.sin(x * 0.023 + y * 0.037 + t * 2),
        detail = Math.sin(x * 0.057 - y * 0.041 - t * 5);
      const ridge = swell * 0.58 + cross * 0.25 + detail * 0.17;
      let g = 0,
        color = 2;
      if (ridge > 0.3) {
        g =
          GI[ridge > 0.77 ? (n > 0.58 ? '=' : '~') : ridge > 0.52 ? '-' : ','];
        color = 3 + (ridge > 0.7 ? 2 : 0);
      } else if (n > 0.56) {
        g = GI[n > 0.87 ? ':' : '.'];
        color = 2;
      }
      if (d < 0.11 && ridge > 0.15) {
        g = GI[n > 0.8 ? '~' : '-'];
        color = 4;
      }
      if (ridge > 0.82 && n > 0.75) {
        g = GI['~'];
        color = 7;
      }
      // Light reflected by the same moving beam, broken by the same wave normals.
      const reflection =
        beamAt(x, horizon - (y - horizon) * 0.85, cs, sn) * (1 - d) * 0.7;
      if (reflection > 0.025 && ridge > 0.08) {
        color = LIGHT + Math.min(6, Math.floor(reflection * 15 + ridge * 2));
        g = GI[ridge > 0.65 ? '=' : '-'];
      }
      // The water stays legible across the entire scene, then dissolves into its background.
      const extinction =
        (1 - smooth(0.78, 1, d) * 0.73) * (1 - smooth(0.42, 0.93, d) * 0.2);
      if (g)
        glyph(
          context,
          index % cols,
          Math.floor(index / cols),
          g,
          color,
          extinction,
        );
    }
    // A whale follows a closed, very slow ellipse. Body scale sets the ecosystem's scale.
    // The ellipse turns beyond the coast's visible bounds: the animal never reverses on stage.
    const wx = W * 0.47 + W * 0.6 * Math.cos(t),
      wy = horizon + 125 + 62 * Math.sin(t);
    creature(
      'whale',
      wx,
      wy,
      p * 8,
      33,
      0.86,
      Math.sin(t) < 0,
      Math.pow(Math.abs(Math.sin(t)), 0.32),
    );
    // Two dolphins share a current. A smooth sixth-power crest gives one brief breach.
    for (let k = 0; k < 2; k++) {
      const a = t - k * 0.37,
        crest = Math.pow(Math.max(0, Math.cos(a)), 6);
      const x = W * 0.46 + W * 0.105 * Math.sin(a) + k * 112,
        y = horizon + 83 - 137 * crest + k * 18;
      const pitch =
        crest > 0.1
          ? Math.atan2(
              822 * Math.sin(a) * Math.pow(Math.max(0, Math.cos(a)), 5),
              W * 0.105 * Math.cos(a),
            ) * 0.8
          : 0;
      creature(
        'dolphin',
        x,
        y,
        p * 12 - k * 0.18,
        crest > 0.45 ? 8 : 34,
        crest > 0.45 ? 0.92 : 0.68,
        Math.cos(a) < 0,
        Math.pow(Math.abs(Math.cos(a)), 0.32),
        pitch,
      );
      if (crest > 0.45) {
        for (let j = -3; j <= 3; j++)
          glyph(
            context,
            Math.round(x / cw) + j,
            Math.round(horizon / ch) + 1,
            GI[j % 2 ? '~' : '-'],
            6,
            (1 - Math.abs(j) / 4) * 0.6,
          );
      }
    }
    // A compact school, with stable offsets and slightly different swimming phases.
    for (let k = 0; k < 5; k++) {
      const a = t + k * 0.08,
        x = W * 0.27 + W * 0.085 * Math.sin(a) + SCHOOL_OFFSETS[k * 2],
        y =
          horizon +
          Math.min(245, H - horizon - 85) +
          24 * Math.cos(a * 2) +
          SCHOOL_OFFSETS[k * 2 + 1];
      creature(
        'fish',
        x,
        y,
        p * 16 + k * 0.11,
        33,
        0.67,
        Math.cos(a) < 0,
        Math.pow(Math.abs(Math.cos(a)), 0.32),
      );
    }
    creature(
      'jelly',
      W * 0.685 + 22 * Math.sin(t),
      horizon + Math.min(235, H - horizon - 75) + 20 * Math.cos(t),
      p * 3,
      33,
      0.63,
    );
    // Small suspended particles describe the current, rather than random blinking.
    for (let k = 0; k < 13; k++) {
      const x = W * (0.11 + noise(k, 0) * 0.62) + 15 * Math.sin(t + k),
        y =
          horizon +
          70 +
          noise(k, 1) * (H - horizon - 110) +
          12 * Math.cos(t + k);
      const c = Math.round(x / cw),
        r = Math.round(y / ch);
      if (c >= 0 && r >= 0 && c < cols && r < rows && !landMat[r * cols + c])
        glyph(context, c, r, GI['.'], 33, 0.4);
    }
    // Grounded kelp responds to the same fundamental current as the jellyfish.
    for (let k = 0; k < 5; k++)
      for (let j = 0; j < 7; j++) {
        const x = W * 0.78 + k * 23 + Math.sin(t + j * 0.5 + k) * j * 2,
          y = H - 45 - j * ch;
        const c = Math.round(x / cw),
          r = Math.round(y / ch);
        if (c < cols && r < rows && r >= 0)
          glyph(context, c, r, GI[j % 2 ? '/' : '|'], 31, 0.7);
      }
    // Three distant gliders circle above the same current.
    for (let k = 0; k < 3; k++) {
      const a = t + k * 0.28,
        x = W * 0.665 + W * 0.092 * Math.sin(a) + k * 33,
        y = ly - 37 + 28 * Math.cos(a) + k * 19;
      creature('bird', x, y, p * (k === 1 ? 3 : 2) + k * 0.2, 36, 0.83);
    }
    context.globalAlpha = 1;
    context.drawImage(land, 0, 0);
    // The lantern is the only persistent amber accent inside the scene.
    const glow = 0.62 + 0.3 * Math.pow(Math.max(0, cs), 3);
    for (let j = -2; j <= 2; j++)
      glyph(
        context,
        Math.round(lx / cw) + j,
        Math.round(ly / ch),
        GI[j === 0 ? '*' : '='],
        j === 0 ? 27 : 26,
        glow * (1 - Math.abs(j) * 0.18),
      );
    // White water traces the cliff's foot; it has no independent random clock.
    for (let k = 0; k < 20; k++) {
      const x = W * 0.75 + k * W * 0.0036,
        y =
          horizon + 135 + (x - W * 0.75) * 0.75 + 6 * Math.sin(t * 3 + k * 0.5);
      const c = Math.round(x / cw),
        r = Math.round(y / ch);
      if (c < cols && r < rows && r >= 0 && landMat[r * cols + c] < 3)
        glyph(
          context,
          c,
          r,
          GI[k % 3 ? '~' : ':'],
          7,
          0.25 + 0.22 * Math.sin(t * 3 + k * 0.4) ** 2,
        );
    }
    context.globalAlpha = 1;
  }
  function timeNow(now = performance.now()) {
    return elapsed + (animation ? (now - clockStart) / 1000 : 0);
  }
  function tick(now) {
    animation = requestAnimationFrame(tick);
    if (now - lastTick < 1000 / 30 - 0.4) return;
    lastTick = now;
    paint(timeNow(now));
  }
  function playback() {
    if (animation) {
      elapsed = timeNow();
      cancelAnimationFrame(animation);
      animation = 0;
    }
    const motionAllowed =
      !userPaused &&
      (!reduced.matches || motionOverride) &&
      visible &&
      !document.hidden;
    if (motionAllowed) {
      clockStart = performance.now();
      lastTick = 0;
      animation = requestAnimationFrame(tick);
    }
    canvas.setAttribute(
      'aria-description',
      animation
        ? 'Animated coast. Press Space to pause.'
        : 'Still coast. Press Space to play.',
    );
  }
  function resize() {
    if (disposed) return;
    const rect = holder.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const mobile = rect.width <= 700,
      oldCols = cols,
      oldRows = rows;
    W = mobile ? 840 : 1944;
    H = (W * rect.height) / rect.width;
    cols = Math.min(440, Math.round(rect.width / (mobile ? 3.5 : 4.6)));
    cw = W / cols;
    ch = cw * 1.5;
    rows = Math.ceil(H / ch);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    tw = Math.ceil((rect.width * dpr) / cols);
    th = Math.ceil(tw * 1.5);
    const pw = cols * tw,
      ph = rows * th;
    if (
      canvas.width === pw &&
      canvas.height === ph &&
      oldCols === cols &&
      oldRows === rows
    )
      return;
    canvas.width = pw;
    canvas.height = ph;
    horizon = mobile ? Math.max(H * 0.45, 350) : H * 0.55;
    lx = W * (mobile ? 0.79 : 0.835);
    ly = horizon - 252;
    base = horizon - 24;
    buildAtlas();
    buildStatic();
    buildWater();
    buildSprites();
    paint(reduced.matches ? 3.1 : timeNow());
    holder.dataset.ready = 'true';
  }
  function onKeydown(event) {
    if (event.code !== 'Space') return;
    event.preventDefault();
    if (reduced.matches && !motionOverride) {
      motionOverride = true;
      userPaused = false;
    } else userPaused = !userPaused;
    playback();
  }
  canvas.addEventListener('keydown', onKeydown, listenerOptions);
  reduced.addEventListener(
    'change',
    () => {
      motionOverride = false;
      playback();
      if (reduced.matches) paint(3.1);
    },
    listenerOptions,
  );
  themePreference.addEventListener('change', applyTheme, listenerOptions);
  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'class', 'style'],
  });
  applyTheme();
  document.addEventListener('visibilitychange', playback, listenerOptions);
  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      visible = entry?.isIntersecting ?? false;
      playback();
    },
    { rootMargin: '80px' },
  );
  visibilityObserver.observe(holder);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(holder);
  resize();
  playback();
  return () => {
    disposed = true;
    cancelAnimationFrame(animation);
    animation = 0;
    events.abort();
    themeObserver.disconnect();
    visibilityObserver.disconnect();
    resizeObserver.disconnect();
    delete holder.dataset.ready;
  };
}
