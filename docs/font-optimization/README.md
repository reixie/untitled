# Font optimization and rendering proof

Font payload falls from **225,616 to 36,188 bytes per published page (83.96% less)**. Both preloads remain; they now fetch the two core files. `font-display: swap`, the `Inter, system-ui, sans-serif` stack, `font-synthesis: none`, all content, component styling and JavaScript are unchanged. There is no font processing in the build and no generated fallback face.

## Measured font files

All sizes are exact WOFF2 body bytes, excluding HTTP headers. Original sources are pinned byte-for-byte in `scripts/font-sources/`, outside `public/` and the deployed site.

| Face              | Original | Core, preloaded | Extended, conditional | Both shards | Reduction, both shards |
| ----------------- | -------: | --------------: | --------------------: | ----------: | ---------------------: |
| Inter regular 400 |  111,268 |          17,896 |                 4,016 |      21,912 |                 80.31% |
| Inter medium 500  |  114,348 |          18,292 |                 3,984 |      22,276 |                 80.52% |
| Total             |  225,616 |      **36,188** |             **8,000** |  **44,188** |             **80.41%** |

Each original has **2,937 glyphs, 2,852 Unicode mappings, no variable axes, no glyph hint programs and no font-wide hinting tables or OpenType device-hint records**. Each core has 407 glyphs / 319 mappings; each extension has 70 glyphs / 10 mappings. The extensions include 55 unencoded reference/closure glyphs to preserve 1× rasterization. These do not expand CSS coverage or trigger downloads.

The original GSUB tables have 39 feature tags: `aalt calt case ccmp cv01–cv14 dlig dnom frac locl numr ordn pnum salt sinf ss01–ss08 subs sups tnum zero`. GPOS has `cpsp kern mark mkmk`. The retained default feature set is `calt ccmp locl kern mark mkmk`; after subsetting, only `calt locl` (GSUB) and `kern` (GPOS) have relevant rules in the cores. Extensions have no layout tables. No opt-in feature is enabled by the site. Hint removal saves **0 bytes** because the inputs are already unhinted.

[Baseline inventory](baseline-fonts.json) records names, hashes, glyph counts, axes, feature tags, hinting and actual Unicode coverage. [Generated inventory](generated-fonts.json) records every output, source hashes, tools and shaping partition. The generator reopens each WOFF2, checks its cmap, names, hints, axes, outlines and advances, and verifies font-wide rendering metrics. Repeated generation produces identical font bytes.

## Actual usage and coverage

[The baseline usage census](usage.json) covers every published route, including hidden homepage panels. It groups text by computed font settings, including inline and component-local styles, and records characters, feature/variation settings, weights, styles, sizes, hyphenation, pseudo content, preloads and actual font requests. Source scanning additionally includes Astro/MDX props, CSS generated content, data strings and client code.

The site uses static weights **400 and 500** only. Headings, bold/strong and buttons resolve to 500; the Showcase buttons explicitly use 13px/500. Headings also use 18px and responsive 24–32px sizes. No axis, weight, optical-size or OpenType-feature override is hidden in an inline style. No published text currently uses italic, code, accented letters, CJK or `hyphens: auto`; separate fixtures test those cases. Italic and bold-inside-italic follow the original `font-synthesis: none` behavior; no italic face or synthesized slant is introduced. Code retains the browser's existing monospace font.

Both faces retain the used characters plus the source's Latin-1 and Latin Extended-A coverage. U+2010 (automatic/explicit hyphen), U+2011, curly quotes, en/em dashes, ellipsis, generated bullet and navigation arrows are explicitly protected. U+00AD and U+0149 have no mappings in the originals; no new glyph is invented for them. Soft-hyphen and CJK fallback behavior stays unchanged. CJK remains in system fonts, confirmed with Chromium's actual platform-font inspection.

The conditional characters are exactly `U+00A4, U+00A6–00A8, U+00AF, U+00B2–00B4, U+00B8–00B9` (`¤ ¦ § ¨ ¯ ² ³ ´ ¸ ¹`). Extension CSS ranges exactly match their cmaps. Core/extension cmaps are disjoint. All four files use the internal derivative family **Site Sans**, with style-specific PostScript names. The supplied OFL has no explicitly designated Reserved Font Name; renaming is conservative. Copyright remains embedded and the complete OFL accompanies the public files.

## Page bytes and preloads

| Published page                         |  Before |  After |   Saved |
| -------------------------------------- | ------: | -----: | ------: |
| `/` — both panels                      | 225,616 | 36,188 | 189,428 |
| `/articles/design-the-second-attempt/` | 225,616 | 36,188 | 189,428 |
| `/work/accord/`                        | 225,616 | 36,188 | 189,428 |
| `/work/pascal/`                        | 225,616 | 36,188 | 189,428 |

Every page previously preloaded `/fonts/inter-regular.woff2` and `/fonts/inter-medium.woff2`. Every page now preloads `/fonts/inter-regular-core.woff2` and `/fonts/inter-medium-core.woff2`, with the same `as`, MIME type and `crossorigin` attributes. Every sample uses a fresh browser context. Neither extension loads on a published route, ordinary punctuation fixture or CJK-only fixture.

A fixture using an extended character at 400 downloads only the regular extension: **40,204 bytes total**. At 500 it downloads only the medium extension: **40,172 bytes total**. A fixture using both downloads **44,188 bytes**. Extended glyphs resolve to the custom font, not a fallback. The detailed cold-cache requests, preloads, face statuses and platform fonts are in [Chromium evidence](browser.json) and [WebKit evidence](webkit/browser.json).

## Rendering proof and deliberate exceptions

Before/after pages use the same content. The initial baseline was built before edits. The repeatable baseline helper also reconstructs the original font delivery from a copy of the current build, preserving current content, assets, components and non-font CSS. No historical screenshot is used as a baseline.

The matrix contains 28 comparisons per engine: all four routes, both homepage panels, 375px and 1200px widths, light/dark themes; typography fixtures additionally cover device scale factors 1 and 2. Fixtures exercise code, italics, bold inside italics, accents and accent/ASCII kerning, all retained Latin-1/Extended-A characters in both weights, a 13px/500 component override, inline overrides, automatic/U+2010/soft hyphens, list markers and CJK. Fixtures are served by the verification tool only and never enter `src/pages/` or `dist/`.

**Final result: 56/56 comparisons pass, with 0 changed pixels, 0 geometry differences, 0 content changes and no accepted rounding differences.**

Exact results and before/after/diff paths are in [Chromium pixel comparisons](pixels.json) and [WebKit pixel comparisons](webkit/pixels.json). Comparisons use **zero tolerance**, no masks and no antialiasing exclusions, and also require identical text and text geometry. Captures use reduced motion and wait for fonts, image decoding, final responsive image candidates, compositor paint and scroll snap. Each final comparison uses a fresh browser process to isolate native glyph caches. Non-font asset files are byte-identical. Successful captures are stored as lossless WebP; every decoded RGB pixel is verified unchanged, with raster SHA-256 hashes in the report. Diff images remain PNG.

Rendering preservation takes precedence over the requested smallest ASCII-only core:

1. **Shaping-connected Latin characters stay in the core.** A strict ASCII/punctuation split preloads 21,652 bytes, 14,536 less than the adopted 36,188. It breaks cross-file kerning: at 16px, `ÀV` grows from 20.640625 to 21.734375px, `Tó` from 18.328125 to 19.578125px and `café` from 32.359375 to 32.828125px. The generator closes the partition over default shaping interactions in both directions and both weights. The strict alternative is an experiment only and is never used by default.
2. **Core faces omit the CSS `unicode-range` descriptor.** In WebKit 26.5 at 1×, adding the otherwise-correct explicit core range changes paragraph rasterization even with untouched original font binaries. Removing it restores rendering. This costs **0 font bytes**; the cmap still restricts actual coverage, and the extensions keep exact ranges. This is the explicit exception to the requested ranges on every file.
3. **Font-wide rendering metadata and glyph names stay intact.** Stripping glyph names/recalculating bounds changes 1× rendering despite equal outlines and advances. Original bounds, classification and scalar rendering metrics are retained; glyph counts and horizontal metric counts still reflect the actual subset. These are metadata, not hint instructions. Discarding glyph names alone would save **2,372 preloaded bytes** (1,172 regular / 1,200 medium), but changes 1× rendering.
4. **Extensions keep unencoded Latin references.** Removing them reduces the two extensions from 8,000 to 2,380 bytes, saving 5,620 conditional bytes, but changes 1× symbol pixels. Smaller upper/lower/stem-only reference sets also fail. The adopted reference set costs **0 bytes on current pages**, because neither extension downloads there. Their layout rules are removed and their cmap remains exactly the ten conditional characters.
5. **Preloaded cores are declared after extensions.** This prevents WebKit from using an unloaded extension's fallback metrics for underline skip-ink. No fallback face is inserted between the shards.

[Rejected optimization and capture controls](diagnostics/experiments.json) include an unchanged-font witness for the core-range issue and exact byte costs. In a pooled Chromium sequence, the same original fonts compared against themselves produced an 840-pixel mixed-DPR cache artifact; the isolated unchanged-font control is zero, the final isolated matrix is zero, and an additional eight pooled original/final comparisons are also zero. Responsive image paint discrepancies disappeared after settling; image sources and bytes are identical. No pixels are masked or tolerated.

The initial raster differences and strict-split kerning differences were regressions to fix, not content changes or accepted rounding. No rendering difference is accepted as harmless. The existing browser suite also passes 70 homepage/article/case theme-width-JavaScript combinations plus keyboard, pointer, touch, resize, navigation, no-JS and CLS checks. Its temporary static server returns 204 for the browser image viewer’s automatic `/favicon.ico` request; the site’s `data:,` icon is unchanged. The evidence covers these macOS Chromium/WebKit configurations; it is not a claim of exhaustive testing on every OS or renderer. Embedding core data in CSS and idle precaching are deferred as requested.

Astro’s existing CSS bundler extracts the larger global stylesheet into a shared **4,943-byte CSS asset**, adding one cold stylesheet request where the original global CSS was inline. Font preloads still start directly from HTML. No build configuration or font processing is added. Validation used Node 26.13.0 and the repository CLIs directly because the environment’s pnpm 11.25.0 does not satisfy the project’s pnpm 12.15.0 pin; package files and lockfile are unchanged.

## Manual regeneration

Nothing is added to `package.json`, CI or the build. A normal build only copies the committed WOFF2 files and CSS.

Install the separate pinned tooling once:

```sh
python3 -m venv /tmp/site-font-tools
/tmp/site-font-tools/bin/pip install -r scripts/font-requirements.txt
```

With the current audited content, regenerate:

```sh
/tmp/site-font-tools/bin/python scripts/subset-fonts.py
pnpm build
```

After changing content or font settings, first refresh the census from the same-content original-font baseline. Use a new baseline directory each time:

```sh
pnpm build
python3 scripts/make-font-baseline.py dist /tmp/site-font-baseline

PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BROWSER_EXECUTABLE=/absolute/path/to/chromium \
FONT_BEFORE_DIR=/tmp/site-font-baseline FONT_AUDIT_ONLY=1 \
node scripts/verify-fonts.mjs

/tmp/site-font-tools/bin/python scripts/subset-fonts.py
pnpm build

PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BROWSER_EXECUTABLE=/absolute/path/to/chromium \
FONT_BEFORE_DIR=/tmp/site-font-baseline \
FONT_PYTHON=/tmp/site-font-tools/bin/python FONT_COMPACT_EVIDENCE=1 \
node scripts/verify-fonts.mjs
```

Playwright stays in an external installation, as with the existing browser verifier. For WebKit, install its matching browser externally, omit `BROWSER_EXECUTABLE`, set `FONT_BROWSER=webkit` and `FONT_EVIDENCE_DIR=docs/font-optimization/webkit`, and repeat the last command. `PLAYWRIGHT_BROWSERS_PATH` can point to a temporary browser installation. `FONT_CASE_FILTER` restricts a diagnostic run; leave it unset for final proof.

Rerun when content, components, inline styles, CSS fonts/weights/features, language/hyphenation or font sources change. Update the route matrix when adding routes. Changes to source fonts require reviewing their pinned SHA-256 values and license, then repeating the inventory and rendering proof. Commit the generated WOFF2 files, `src/styles/fonts.css`, inventory, usage census and refreshed evidence with the corresponding change. Generated JSON uses deterministic serialization and is excluded from Prettier; the CSS already matches project formatting.

`--strict-split` is a known-regressing experiment and requires separate output, CSS and report paths. It cannot overwrite production outputs. Failed pixel comparisons exit nonzero; do not bless a new screenshot or ignore changed pixels to get a pass.

Reference: [fontTools subset options](https://fonttools.readthedocs.io/en/latest/subset/index.html), [CSS unicode-range behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face/unicode-range).
