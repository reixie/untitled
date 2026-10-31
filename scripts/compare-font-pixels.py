#!/usr/bin/env python3
"""Exact pixel comparisons. No antialiasing exclusions or tolerated differences."""
import json
import hashlib
import os
import sys
from pathlib import Path

from PIL import Image, ImageChops

root = Path(sys.argv[1])
browser = json.loads((root / "browser.json").read_text())
results = []
for pair in browser["comparisons"]:
    before = Image.open(root / "screenshots" / pair["before"]).convert("RGB")
    after = Image.open(root / "screenshots" / pair["after"]).convert("RGB")
    assert before.size == after.size, (pair["id"], before.size, after.size)
    diff = ImageChops.difference(before, after)
    pixels = sum(1 for pixel in diff.getdata() if pixel != (0, 0, 0))
    maximum = max(hi for _, hi in diff.getextrema())
    name = pair["id"] + "-diff.png"
    # Bright red marks every changed pixel; exact matches produce black files.
    # The max-channel mask catches even changes too small for luminance conversion.
    bands = diff.split()
    mask = ImageChops.lighter(ImageChops.lighter(bands[0], bands[1]), bands[2]).point(lambda n: 255 if n else 0)
    visual = Image.new("RGB", diff.size)
    visual.paste((255, 0, 0), mask=mask)
    visual.save(root / "screenshots" / name, optimize=True)
    results.append({**pair, "diff": name, "size": before.size, "changedPixels": pixels,
                    "maxChannelDifference": maximum, "bounds": diff.getbbox()})
(root / "pixels.json").write_text(json.dumps({"tolerance": 0, "comparisons": results}, indent=2) + "\n")
failures = [p for p in results if p["changedPixels"] or not p["geometryIdentical"]]
print(f"{len(results)} exact pixel comparisons; {sum(p['changedPixels'] for p in results):,} changed pixels; {len(failures)} regressions")
for failure in failures:
    print(failure["id"], failure["changedPixels"], failure["bounds"], "geometry identical:", failure["geometryIdentical"])
if not failures and os.environ.get("FONT_COMPACT_EVIDENCE") == "1":
    for result, pair in zip(results, browser["comparisons"]):
        for key in ["before", "after"]:
            path = root / "screenshots" / pair[key]
            raster = Image.open(path).convert("RGB")
            sha = hashlib.sha256(raster.tobytes()).hexdigest()
            target = path.with_suffix(".webp")
            raster.save(target, lossless=True, quality=100, method=4)
            assert not ImageChops.difference(raster, Image.open(target).convert("RGB")).getbbox()
            path.unlink()
            pair[key] = result[key] = target.name
            result[key + "RasterSha256"] = sha
    (root / "browser.json").write_text(json.dumps(browser, indent=2) + "\n")
    (root / "pixels.json").write_text(json.dumps({"tolerance": 0, "comparisons": results}, indent=2) + "\n")
    print("Saved lossless WebP evidence; every decoded RGB pixel was verified unchanged.")
sys.exit(bool(failures))
