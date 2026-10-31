# On the horizon — implementation and verification

> Historical report for the initial footer with HTML copy and contact links. The current art-only version and light/dark theme verification are documented in `docs/coast-art-verification/verification.md`.

Completed 31 October 2026. The deliverable is `/Users/alex/Developer/untitled/index.html` (30,726 bytes). It contains its own HTML, CSS, JavaScript and procedural artwork. No library, image, font download, build step or server is required. The existing Astro portfolio and the original Downloads file were left unchanged.

## Source assessment

The primary reference was `/Users/alex/Downloads/index.html`, the 1944 × 1760 Hawaiian lagoon experiment.

Preserved:

- Supersampled geometry averaged into an explicit monospace cell grid. The lagoon used 4 × 4 coverage samples; this footer uses 3 × 3 samples and cached sprite poses.
- Seeded spatial detail and precomputed static scenery: the reef-cache idea becomes cached sky, headlands, cliff and lighthouse.
- Pure time-based motion, closed trigonometric trajectories, and the 24.5-second period.
- Depth expressed through material, density and color rather than a collection of independent decorative effects.

Changed:

- The top-down camera becomes a side view with a horizon, compressed distant waves, tapered tower, stratified cliff and shallow underwater view.
- Colored cell rectangles become glyph-only silhouettes. Vector masks are used only offscreen; every visible shape and light mark is a character on the same grid.
- Per-frame full-layer `getImageData`, fresh float buffers, color arrays, `fillText`, gradients and full-scene blur become cached coverage, typed arrays and atlas blits. The animation loop allocates no arrays, canvases or color strings.
- Arbitrary top-down heading rotations become projected turns, tangent-derived dolphin pitch and a whale ellipse whose reversals occur beyond the visible coast.
- Time-bucketed random glyph changes become stationary seeded texture. In the source, `floor(t * 7)` is not commensurate with 24.5 seconds (171.5 buckets per period), so it can change discontinuously across the seam even though the positional paths close.
- Fixed-stage scaling becomes a responsive grid, with a separately composed mobile coastal area and HTML text that reflows normally.

## Art direction and rendering

The reading order is contact invitation, lighthouse, ocean life. Wave contrast is suppressed around the CTA, and both water and rock marks recede before the footer links. The small amber palette is shared by the CTA, lamp, atmospheric beam and its broken reflection.

The master phase is `θ = 2π × (t mod 24.5) / 24.5`. All changing frequencies are integer harmonics. Water combines three sine fields with logarithmically compressed vertical phase; static noise breaks up the crests. The lighthouse beam projects a rotating azimuth into a tapered, distance-attenuated cone. A mirrored sample of that same cone, interrupted by the wave field, produces the water reflection.

Animal masks use coverage to choose dense body characters and sparse boundary characters. A pose atlas animates flukes, wingbeats and jellyfish pulse. Dolphins share a closed path with a brief sixth-power cosine breach; their pitch follows the analytic path derivative. Projected yaw and a reused visitation buffer prevent compressed silhouettes from drawing the same cell repeatedly. The whale, fish, suspended particles and kelp share the same fundamental current with different harmonic rhythms.

Playback targets 30 fps, giving 735 nominal frames per loop. Absolute phase avoids frame-rate-dependent simulation drift. Offscreen or hidden playback is suspended. Reduced motion renders a still; an explicit play button can override that preference. A later preference change is respected again.

## Acceptance results

| Criterion                              | Evidence and result                                                                                                                                                                                                                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact endpoint equality                | 0 differing pixels at 0 and 24.5 seconds. Also 0 differing channels in Chromium and WebKit at 1944 and 375 px with DPR 2; at 700 px after the responsive correction.                                                                                                                                        |
| Continuity immediately around the seam | At 30 fps, the boundary changed 0.258% of pixels, with mean RGB-channel change 0.0353 / 255. Across 32 ordinary transitions, the range was 0.125–0.272% and 0.0081–0.0468 / 255. The boundary lies inside both ordinary ranges.                                                                             |
| Whole-cycle visual review              | Captured and inspected 0, 3.1, 6.125, 9.1875, 12.25, 15.3125, 18.375, 21.4375 and 24.5 seconds. The lighthouse remains static and identifiable; the beam, wildlife and water move around it.                                                                                                                |
| Responsive layout                      | Passed at 1944, 1440, 1024, 768, 701, 700, 390, 375 and 320 px. No horizontal overflow; CTA stays within the viewport; copy stays above the footer metadata.                                                                                                                                                |
| Lighthouse crop                        | Fixed the roof crop near the 700 px breakpoint by establishing a minimum mobile horizon height. Verified in both engines: roof is 20 world units below the canvas top at 700 px.                                                                                                                            |
| Silhouette review                      | Roof, lantern, tapered striped tower and rocky ridge remain readable at phone size. Whale head, flukes and pectoral fin differ from the dolphins' beaks and dorsal fins. Fish spacing was adjusted to preserve individual silhouettes. Fine extremities simplify at small sizes and during projected turns. |
| Keyboard and motion controls           | Contact is the first Tab stop and has a visible focus outline. Pause stops frame production; resume restarts it. Reduced motion stops animation; explicit play and pause work. Hiding the scene suspends playback; showing it resumes.                                                                      |
| No JavaScript                          | Contact and social links remain usable; motion controls stay hidden. Verified at 375 px.                                                                                                                                                                                                                    |
| Text contrast                          | Against the base background, tested HTML foreground colors range from 8.53:1 to 15.73:1. These are base-color measurements, not a claim of a complete WCAG audit over every animated pixel.                                                                                                                 |
| 200% scaling                           | CSS zoom smoke check in both engines: no horizontal document overflow, CTA remains inside viewport, copy and bottom metadata remain separate. This is not a substitute for physical-device accessibility testing.                                                                                           |
| Runtime errors                         | No page JavaScript errors in the captured Chromium or WebKit runs.                                                                                                                                                                                                                                          |
| Self containment                       | One inline script; no external scripts, stylesheets or image dependencies. Inline JavaScript parses successfully.                                                                                                                                                                                           |

## Performance measurements

Headless browser measurements on this Mac; browser versions were Chromium 156.0.8078.74 and WebKit 26.5. Each DPR 2 live sample ran for approximately 6.4 seconds; the rolling profile retains 180 rendered samples.

| Engine   | CSS width / DPR | 95th-percentile render CPU time | Mean rendered-frame interval |
| -------- | --------------- | ------------------------------- | ---------------------------- |
| Chromium | 1944 / 2        | 6.0 ms                          | 33.33 ms                     |
| Chromium | 375 / 2         | 2.5 ms                          | 33.33 ms                     |
| WebKit   | 1944 / 2        | 4.0 ms                          | 33.70 ms                     |
| WebKit   | 375 / 2         | 2.0 ms                          | 34.63 ms                     |

The final Chromium DPR 1 profile at 1440 px measured 1.6 ms median and 2.0 ms p95 render time, with a 33.33 ms mean frame interval. The accompanying 6.5-second browser timeline recorded 390 JavaScript function events, 313.3 ms combined duration and a 2.34 ms maximum event. This measures CPU submission and callback work; it does not isolate GPU compositing cost.

The unpaced 120-frame stress batches in `report.json` intentionally submit frames back-to-back. They produced 22.7–85.1 ms maximum outliers despite p95 values below 7.3 ms. They expose queue/flush costs and are not used as evidence of smooth playback. Paced live profiling supplies the frame-rate results above.

Yab was also used for visual inspection and live execution. Its 1280 px / DPR 2 run reported 3 ms p95 and a 36.1 ms average rendered-frame interval in the captured rolling window.

Physical iOS/Android hardware, low-power modes, other GPUs and a screen-reader session were not tested. WebKit and mobile viewport/DPR emulation are the available cross-browser evidence. Performance numbers are observations on this Mac, not universal device guarantees.

## Evidence files

- `report.json`: layout matrix, controls, no-JavaScript check, DPR 1 profiling and exact-boundary differences.
- `cross-browser.json`: Chromium/WebKit high-DPI profiles and pixel comparisons.
- `final-checks.json`: corrected 700 px geometry, offscreen playback, contrast and scaling checks.
- `seam-distribution.json`: ordinary-frame comparisons and both sides of the boundary.
- `browser-trace.json`: importable Chromium timeline.
- `cycle-*.png`, `layout-*.png`, `*-dpr2.png`: captured visual evidence.

For repeatable manual inspection, open the HTML with `?inspect=1&still=6.125`. Inspection is opt-in and introduces no UI controls into the footer. A `coast:inspect` document event with JSON detail `{ "time": 0 }` selects an exact frame; `{ "play": true }` resumes playback. Normal visits expose no diagnostic interface.
