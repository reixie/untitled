#!/usr/bin/env python3
"""Restore only the original font delivery in a copy of the current build.

This keeps the baseline's content, assets, components and non-font CSS identical.
Usage: python3 scripts/make-font-baseline.py dist /tmp/site-font-baseline
"""
import re
import shutil
import sys
from pathlib import Path

source, target = map(Path, sys.argv[1:])
assert source.is_dir() and not target.exists(), "Use a built site and a new destination"
shutil.copytree(source, target)
original = "\n".join(
    "@font-face {\n  font-family: 'Inter';\n"
    f"  src: url('/fonts/inter-{style}.woff2') format('woff2');\n"
    f"  font-style: normal;\n  font-weight: {weight};\n  font-display: swap;\n}}"
    for style, weight in [("regular", 400), ("medium", 500)]
)
replaced = 0
for path in sorted(target.rglob("*")):
    if path.suffix not in [".html", ".css"]:
        continue
    text = path.read_text()
    faces = list(re.finditer(r"@font-face\s*\{[^}]*\}", text))
    faces = [m for m in faces if re.search(r"/fonts/inter-(regular|medium)-(core|extended)\.woff2", m.group())]
    for index, match in reversed(list(enumerate(faces))):
        text = text[:match.start()] + (original if index == 0 else "") + text[match.end():]
    replaced += len(faces)
    text = re.sub(r"(/fonts/inter-(?:regular|medium))-core(\.woff2)", r"\1\2", text)
    path.write_text(text)
assert replaced >= 4, "No generated font declarations found; inspect the built CSS"
for path in (target / "fonts").glob("inter-*-*.woff2"):
    path.unlink()
for style in ["regular", "medium"]:
    shutil.copyfile(Path(__file__).parent / "font-sources" / f"inter-{style}.woff2",
                    target / "fonts" / f"inter-{style}.woff2")
print(f"Original fonts restored in {target}; {replaced} face declarations replaced. Content unchanged.")
