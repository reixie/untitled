# Design sources

Read-only inspection of [Personal Website](https://www.figma.com/design/HT0C9Z1FeCBUDVYbjXOn9Y/Personal-Website?node-id=0-1) on 2026-10-23. Figma was not edited. Exact variable floats, modes, image paints, image hashes and observed geometry are retained in `figma-source.json`.

The tables below retain the Stage 1 source mapping. Stage 2 re-read current metadata, design contexts and screenshots for `1:3`, `42:303`, `42:909`, `42:937`; the IDs still resolve. Its newly verified copy, hyperlink values, image paints and dark text bindings are retained in `stage-2/design-evidence.json`.

Stage 2 implementation choices:

- Owner-approved correction: **Konexta Agency**, replacing Figma's **Koncepta Agency**. The roles remain Product Designer for Konexta Agency / Valorx and UI/UX Designer for Roxfit / OptiHint. Company destinations come from the owner's confirmed URLs.
- Contact hrefs are read from text ranges in `1:32` (and repeated `42:948`). Runnel and Writing text ranges have no hyperlinks or prototype reactions. Their targets and the case targets remain explicit nulls in `src/data/homepage.ts`.
- The avatar uses `--color-image-border` for both themes. This intentionally gives a white 10% stroke in Dark instead of retaining the unbound black literal. Its empty alt is deliberate because the adjacent heading already identifies the owner.
- The unchanged 16×16 source arrow is a CSS mask colored with Secondary. Case borders use Image Border; content rows and Runnel use Border 1, with Border 2 on actual link hover.
- Three work images retain source order; `42:378` is initially centered. The first image's historical filename says `task-board`, but direct image inspection shows a notes/research interface. Alt text describes that visible content. No project/client attribution is inferred.
- Source PNG hashes still match all five Stage 1 hashes. Astro generates local WebP derivatives and centered 3:2 cover crops for work images; square avatar/icon derivatives preserve their source geometry.
- The Dark Selected work screenshot still loses portions of headings/company names despite current Primary bindings resolving to `#eeeeee` at `42:956`, `I42:958;42:229` and `I42:965;41:197`. The implementation follows resolved tokens and keeps all text visible. The cause of the source render discrepancy remains unresolved; no invisible text or masking was reproduced.

## Actual Figma variables

Collection `Colors` (`VariableCollectionId:1:15`): Light `1:0`, Dark `1:1`, default Light. Only these ten colors are Figma variables. Equal values retain independent roles.

| Figma variable           | Variable ID | CSS property             | Light              | Dark                     | Observed binding                                                    |
| ------------------------ | ----------- | ------------------------ | ------------------ | ------------------------ | ------------------------------------------------------------------- |
| Text & Icons/Primary     | `1:16`      | `--color-text-primary`   | `#202020`          | `#eeeeee`                | Name `1:12`, text fill                                              |
| Text & Icons/Secondary   | `1:17`      | `--color-text-secondary` | `#646464`          | `#b4b4b4`                | Role `1:13`; arrow instance vector `I42:206;42:203`, fill           |
| Text & Icons/Tertiary    | `1:18`      | `--color-text-tertiary`  | `#838383`          | `#7b7b7b`                | No binding found on inspected website/button/item pages; retained   |
| Backgrounds/Background 1 | `2:2`       | `--color-background-1`   | `#ffffff`          | `#000000`                | Website `1:3`, fill                                                 |
| Backgrounds/Background 2 | `2:3`       | `--color-background-2`   | `#ffffff`          | `#0a0a0a`                | Card `39:23`, fill                                                  |
| Borders/Border 1         | `39:4`      | `--color-border-1`       | `#d9d9d9`          | `#3a3a3a`                | Card `39:23`, default writing item `41:198`, stroke                 |
| Borders/Border 2         | `42:286`    | `--color-border-2`       | `rgb(82% 82% 82%)` | `rgb(26% 26% 26%)`       | Hover writing item `42:282`, hover experience item `42:288`, stroke |
| Borders/Image Border     | `42:563`    | `--color-image-border`   | `rgb(0 0 0 / 10%)` | `rgb(255 255 255 / 10%)` | Case `42:382`, stroke                                               |
| Interactions/Hover       | `41:57`     | `--color-hover`          | `#f0f0f0`          | `#252525`                | Button hover `41:53`, fill                                          |
| Interactions/Selected    | `41:58`     | `--color-selected`       | `#e8e8e8`          | `#2f2f2f`                | Button selected `41:55`, fill                                       |

IDs in the table have the `VariableID:` prefix in Figma. Border 2 deliberately retains fractional sRGB channels (209.1 / 66.3), and Image Border retains 0.1 alpha. Floating-point storage noise is normalized. Do not round them to `#d1d1d1`, `#424242` or hex alpha `1a`.

The avatar's border is an unbound literal black at 10% in the Light reference. It was not rendered in Stage 1; Stage 2 deliberately uses semantic Image Border in both themes. The source SVG has literal `#646464`; Stage 2 uses the unchanged SVG as a CSS mask with Secondary as its color, preserving its 16×16 geometry.

## Typography and implementation constants

Typography is read from nodes/text styles, not color variables: name `1:12` is Inter Medium 500; role `1:13` and bio `1:25` are Inter Regular 400; all are 16px/20px. Button labels `41:50` and `41:56` are Medium 500, 13px/20px. All use −1.1% tracking, represented as `-0.011em` (−0.176px at 16px and −0.143px at 13px).

`foundations.css` contains derived implementation constants: 600px content maximum from `42:638`, 64px vertical padding from `1:3`, and text sizes/weights/tracking above. The 24px responsive horizontal gutter is an implementation choice, not a Figma variable or an approved mobile design. Rem values preserve these measurements with the default 16px root and respect the user's font-size setting.

Other observed geometry is recorded for later stages, not promoted into an invented spacing system: bio gap 24px, paragraph gap 16px, section gap 64px, profile gap 12px, avatar 40×40, card 300×400 with 16px radius, case slots 600×400 with 16px radius, strokes 0.5px.

## Local original assets

Five original raster files are in `src/assets/images/`; the original vector is in `src/assets/icons/`. Stage 1 retained them as unused source assets. Stage 2 renders optimized derivatives and the vector mask; the original PNGs are not copied to output. Raster bytes were downloaded through Figma's raw-image export, not screenshot/rasterized-node exports. Each original's SHA-1 equals its source `imageHash`; downloaded thumbnail variants were discarded.

| File                                        | Source node(s)                                                         | Original dimensions        | SHA-1 / Figma imageHash                                                    | Source slot                        |
| ------------------------------------------- | ---------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------- | ---------------------------------- |
| `alex-lohinov-avatar-original.png`          | `1:5`, repeated `42:306`                                               | 1254×1254                  | `e544378ab5e9c37275fe5c3cea0336fef474d557`                                 | 40×40, circular mask, radius 100px |
| `runnel-terminal-icon-original.png`         | component `39:20`, instance `I39:23;39:20`                             | 1024×1024, 16-bit RGBA     | `96ef2d6b9a5d34b0c12d42474e46c8b2a967bcbd`                                 | 40×40, no extra radius             |
| `selected-work-task-board-original.png`     | `42:382`                                                               | 4096×2304                  | `90b13acd29cefdc270abae435732401e7196dedc`                                 | 600×400, radius 16px               |
| `selected-work-company-table-original.png`  | `42:378`                                                               | 4096×2304                  | `0037b5834527ba8cddea5c531476424fbcf5d184`                                 | 600×400, radius 16px               |
| `selected-work-vocabulary-app-original.png` | `42:393`                                                               | 4096×2304                  | `6d5b94acf181c735de8dbdf46002778565ddcc5e`                                 | 600×400, radius 16px               |
| `arrow-right.svg`                           | component `42:205`, vector `42:203`; website instance `I42:209;42:206` | SVG root and viewBox 16×16 | SHA-256 `1cdc018302381361709bf3ae451d598b781855e678425b2186e9756b12eac829` | 16×16                              |

All raster paints use `FILL`, identity `imageTransform` `[[1,0,0],[0,1,0]]`, rotation 0, scalingFactor 0.5, opacity 1 and neutral image filters. These are retained verbatim in the snapshot. At the original case slots, the intended cover crop uses scale `max(600/4096, 400/2304)` = 0.173611…, giving 711.111…×400 rendered pixels and about 55.556px clipped on each horizontal side. In original coordinates, the centered visible region is x=320, y=0, width=3456, height=2304. Preserve original bytes and recreate cropping with `object-fit: cover; object-position: center`; confirm this against the selected final composition in Stage 2. Avatar/icon are square and need no aspect-ratio crop.

The gallery reference `42:316` shows three side-by-side case slots wider than the content column. Stage 1 did not infer behavior. Stage 2 implements the owner's confirmed native horizontal scrolling and touch swiping, initially centering `42:378`.

**Unresolved descriptions:** the three images are named `Case` in Figma. Project names, attribution, captions and links still need confirmation. Stage 2 alt text comes from direct inspection, including the research/notes interface in the historically named `task-board` file. The avatar is decorative next to the owner's name. The Runnel card's long feedback-loop description remains inconsistent with its terminal subtitle and needs editorial review.

## Fonts

Unmodified static files from the [Inter v4.1 release tag](https://github.com/rsms/inter/tree/v4.1/docs/font-files), authored by the Inter Project Authors:

| Local file                         | Upstream file         | CSS weight | SHA-256                                                            |
| ---------------------------------- | --------------------- | ---------- | ------------------------------------------------------------------ |
| `public/fonts/inter-regular.woff2` | `Inter-Regular.woff2` | 400        | `e06f6b1bc553aaea4e4668023ed0ab0a147129c3107f511bc7d03d361b0ae085` |
| `public/fonts/inter-medium.woff2`  | `Inter-Medium.woff2`  | 500        | `0ff3e94614e1493eb556314fd247ae6c4a85a7783b4cc86be539940cf83f2a48` |

The complete upstream license is retained as `public/fonts/OFL.txt`. Files include the upstream full glyph coverage, without generated subsets. Figma reports the family/styles and weight, but not the installed font binary/version; exact cross-version font rasterization parity remains unverified. Only the required upright weights are declared; `font-synthesis: none` prevents fabricated bold/italic styles. Future article typography must explicitly decide whether italic/other weights are needed.
