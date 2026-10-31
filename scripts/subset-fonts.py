#!/usr/bin/env python3
"""Manual, deterministic font maintenance. Never imported by the site/build."""

import argparse
import hashlib
import io
import json
from pathlib import Path

import brotli
import fontTools
import uharfbuzz as hb
from fontTools import subset
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.woff2 import WOFF2FlavorData

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "scripts/font-sources"
FEATURES = ["calt", "ccmp", "locl", "kern", "mark", "mkmk"]
RASTER_REFERENCE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
# Includes generated list markers and automatic/explicit hyphens, even though
# today's styles do not use hyphens:auto. Missing source glyphs stay system-drawn.
PUNCTUATION = {0xA0, 0x2010, 0x2011, 0x2013, 0x2014, 0x2018, 0x2019,
               0x201C, 0x201D, 0x2022, 0x2026, 0x2190, 0x2197}
SOURCE_HASHES = {
    "regular": "e06f6b1bc553aaea4e4668023ed0ab0a147129c3107f511bc7d03d361b0ae085",
    "medium": "0ff3e94614e1493eb556314fd247ae6c4a85a7783b4cc86be539940cf83f2a48",
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def ranges(points):
    runs = []
    for cp in sorted(points):
        if runs and cp == runs[-1][1] + 1:
            runs[-1][1] = cp
        else:
            runs.append([cp, cp])
    return ", ".join(f"U+{a:04X}" + (f"-{b:04X}" if b != a else "") for a, b in runs)


def inventory(path):
    font = TTFont(path)
    glyphs = font["glyf"]
    return {
        "bytes": path.stat().st_size,
        "sha256": digest(path.read_bytes()),
        "glyphs": len(font.getGlyphOrder()),
        "codepoints": len(font.getBestCmap()),
        "unicodeRange": ranges(font.getBestCmap()),
        "axes": [{"tag": a.axisTag, "min": a.minValue, "default": a.defaultValue,
                  "max": a.maxValue} for a in font["fvar"].axes] if "fvar" in font else [],
        "features": {tag: sorted({r.FeatureTag for r in font[tag].table.FeatureList.FeatureRecord})
                     if tag in font and font[tag].table.FeatureList else []
                     for tag in ["GSUB", "GPOS"]},
        "hinting": {
            "tables": [t for t in ["fpgm", "prep", "cvt ", "hdmx", "VDMX", "gasp"] if t in font],
            "glyphPrograms": sum(bool(getattr(glyphs[n], "program", None) and
                                      glyphs[n].program.getBytecode()) for n in font.getGlyphOrder()),
        },
        "names": {str(n.nameID): n.toUnicode() for n in font["name"].names},
    }


def shaper(font):
    font.flavor = None
    buf = io.BytesIO()
    font.save(buf)
    hfont = hb.Font(hb.Face(buf.getvalue()))
    hfont.scale = (font["head"].unitsPerEm, font["head"].unitsPerEm)

    def shape(text, features=None):
        buffer = hb.Buffer()
        buffer.add_str(text)
        buffer.guess_segment_properties()
        hb.shape(hfont, buffer, features)
        return tuple((i.codepoint, p.x_advance, p.y_advance, p.x_offset, p.y_offset)
                     for i, p in zip(buffer.glyph_infos, buffer.glyph_positions))

    return shape


def keep_shaping_together(font, requested, initial):
    """Close the partition under default shaping interactions, across both weights.

    CSS unicode-range faces break shaping runs. A character interacting with the
    core must join it, otherwise even a correct subset loses cross-file kerning.
    Check *both* orders, not just Latin capitals. No pixel tolerance is used.
    """
    shape = shaper(font)
    singles = {cp: shape(chr(cp)) for cp in requested}
    core = set(initial)
    edges = []
    while True:
        promote = set()
        for cp in sorted(requested - core):
            for other in sorted(core):
                for a, b in [(other, cp), (cp, other)]:
                    if shape(chr(a) + chr(b)) != singles[a] + singles[b]:
                        promote.add(cp)
                        edges.append([f"U+{a:04X}", f"U+{b:04X}"])
                        break
                if cp in promote:
                    break
        if not promote:
            return core, edges
        core |= promote


def rename(font, style, part):
    # CSS stays 'Inter'. Internal derivative names never claim upstream identity.
    # The supplied OFL has no explicitly designated RFN; renaming is conservative.
    family = "Site Sans"
    values = {1: family, 2: style.title(),
              4: f"{family} {style.title()}", 6: f"SiteSans-{style.title()}"}
    for name_id, value in values.items():
        font["name"].setName(value, name_id, 3, 1, 0x409)


def generate(source, target, points, style, part):
    font = TTFont(source, recalcTimestamp=False)
    raster_bounds = {tag: {k: getattr(font[tag], k) for k in keys} for tag, keys in {
        "head": ["xMin", "xMax", "yMin", "yMax"],
        "hhea": ["advanceWidthMax", "minLeftSideBearing", "minRightSideBearing", "xMaxExtent"],
        "OS/2": ["ulUnicodeRange1", "ulUnicodeRange2", "ulUnicodeRange3", "ulUnicodeRange4",
                 "ulCodePageRange1", "ulCodePageRange2"],
    }.items()}
    raster_bounds["maxp"] = {k: v for k, v in vars(font["maxp"]).items()
                              if k != "numGlyphs" and isinstance(v, int)}
    opts = subset.Options()
    opts.layout_features = FEATURES
    opts.hinting = False
    opts.recalc_timestamp = False
    opts.recalc_average_width = False
    # CoreText uses glyph names and the global bounds when rasterizing unhinted
    # fonts at 1x. Dropping/recalculating either changes pixels, even with identical
    # outlines and advances. Preserve both; no hint programs are retained.
    opts.glyph_names = True
    # Copyright remains embedded; the complete OFL accompanies every output in
    # public/fonts/OFL.txt. Remove optional version/unique/typographic name records.
    opts.name_IDs = [0, 1, 2, 4, 6]
    opts.name_languages = [0x409]
    # Avoid environment-dependent automatic selection of the serializer.
    opts.harfbuzz_repacker = True
    sub = subset.Subsetter(options=opts)
    # Very small symbol-only fonts rasterize differently at 1x. Retain the
    # experimentally verified Latin reference set and its glyph closure, without
    # mapping those characters in the extension's cmap or advertising them in CSS.
    # Smaller upper/lower/stem-only sets all failed exact browser pixel tests.
    helpers = set(map(ord, RASTER_REFERENCE_CHARACTERS)) \
        if part == "extended" and len(points) <= 16 else set()
    sub.populate(unicodes=points | helpers)
    sub.subset(font)
    if helpers:
        for table in font["cmap"].tables:
            if table.isUnicode():
                table.cmap = {cp: name for cp, name in table.cmap.items() if cp in points}
        # Layout rules for the unencoded references cannot be used. The encoded
        # extension has no default substitutions or positioning interactions.
        shape = shaper(TTFont(source))
        disabled = {tag: False for tag in FEATURES}
        assert all(shape(chr(a) + chr(b)) == shape(chr(a) + chr(b), disabled)
                   for a in points for b in points)
        for tag in ["GSUB", "GPOS", "GDEF"]:
            if tag in font:
                del font[tag]
    rename(font, style, part)
    if "GSUB" in font and not font["GSUB"].table.FeatureList.FeatureRecord:
        del font["GSUB"]
    # fontTools can leave a kern feature with only zero-valued class pairs.
    # Prove it has no effect over the entire small extension before dropping it.
    if part == "extended" and "GPOS" in font:
        tags = {r.FeatureTag for r in font["GPOS"].table.FeatureList.FeatureRecord}
        if tags <= {"kern"}:
            shape = shaper(font)
            if all(shape(chr(a) + chr(b)) == shape(chr(a) + chr(b), {"kern": False})
                   for a in points for b in points):
                del font["GPOS"]
    if "GSUB" not in font and "GPOS" not in font and "GDEF" in font:
        del font["GDEF"]
    font.recalcBBoxes = False
    for tag, values in raster_bounds.items():
        for key, value in values.items():
            setattr(font[tag], key, value)
    font.flavor = "woff2"
    # Both WOFF2 encodings are lossless; hmtx transform is not always smaller.
    encodings = []
    for transforms in [{"glyf", "loca"}, {"glyf", "loca", "hmtx"}]:
        font.flavorData = WOFF2FlavorData(transformedTables=transforms)
        data = io.BytesIO()
        font.save(data)
        encodings.append(data.getvalue())
    target.write_bytes(min(encodings, key=len))
    # Validate the serialized result, not the in-memory object.
    actual = TTFont(target)
    assert actual["post"].formatType == 2.0, (target, "glyph names lost")
    for tag, values in raster_bounds.items():
        assert all(getattr(actual[tag], key) == value for key, value in values.items()), \
            (target, tag, "rendering metadata changed during serialization")
    assert set(actual.getBestCmap()) == points, (target, "cmap mismatch")
    assert not inventory(target)["axes"]
    assert inventory(target)["hinting"] == {"tables": [], "glyphPrograms": 0}
    assert all(not n.toUnicode().startswith("Inter") for n in actual["name"].names
               if n.nameID in [1, 3, 4, 6, 16])
    original = TTFont(source)
    for tag, fields in {"head": ["unitsPerEm", "xMin", "xMax", "yMin", "yMax"],
                        "hhea": ["ascent", "descent", "lineGap", "advanceWidthMax", "minLeftSideBearing", "minRightSideBearing", "xMaxExtent"],
                        "OS/2": ["sTypoAscender", "sTypoDescender", "sTypoLineGap",
                                 "usWinAscent", "usWinDescent", "sxHeight", "sCapHeight"]}.items():
        assert all(getattr(original[tag], k) == getattr(actual[tag], k) for k in fields)
    for cp in points:
        a, b = original.getBestCmap()[cp], actual.getBestCmap()[cp]
        assert original["hmtx"][a] == actual["hmtx"][b], (target, cp, "metrics")
        pens = []
        for f, name in [(original, a), (actual, b)]:
            gs = f.getGlyphSet()
            pen = DecomposingRecordingPen(gs)
            gs[name].draw(pen)
            pens.append(pen.value)
        assert pens[0] == pens[1], (target, cp, "outline")
    return inventory(target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "public/fonts")
    parser.add_argument("--css", type=Path, default=ROOT / "src/styles/fonts.css")
    parser.add_argument("--report", type=Path, default=ROOT / "docs/font-optimization/generated-fonts.json")
    parser.add_argument("--strict-split", action="store_true",
                        help="EXPERIMENT ONLY: smaller core with known cross-file kerning regressions")
    args = parser.parse_args()
    if args.strict_split:
        assert args.output.resolve() != ROOT / "public/fonts" and \
            args.css.resolve() != ROOT / "src/styles/fonts.css" and \
            args.report.resolve() != ROOT / "docs/font-optimization/generated-fonts.json", \
            "Experiments must use separate --output, --css and --report paths"
    assert (fontTools.__version__, brotli.__version__, hb.__version__) == ("4.60.2", "1.1.0", "0.51.7")
    source_files = sorted(p for p in (ROOT / "src").rglob("*")
                          if p.suffix in [".astro", ".css", ".ts", ".md", ".mdx"]
                          and p.name != "fonts.css")
    # Conservatively include source strings too: MDX props, hidden labels,
    # component-local/inline styles, client-rendered text, and generated content.
    source_text = "".join(p.read_text() for p in source_files)
    used = {ord(c) for c in source_text}
    corpus_path = ROOT / "docs/font-optimization/usage.json"
    if corpus_path.exists():
        for page in json.loads(corpus_path.read_text())["pages"]:
            used |= {ord(c) for c in page["text"]}
    policy = set(range(0x20, 0x180)) | used | PUNCTUATION
    report = {"tools": {"fonttools": fontTools.__version__, "brotli": brotli.__version__,
                        "uharfbuzz": hb.__version__},
              "rasterReferences": RASTER_REFERENCE_CHARACTERS,
              "coreCssRange": "omitted to preserve WebKit 1x rendering; coverage is restricted by cmap",
              "faceOrder": "extended, then preloaded core for each weight",
              "featuresRequested": FEATURES, "strictSplit": args.strict_split,
              "inputs": {str(p.relative_to(ROOT)): digest(p.read_bytes()) for p in source_files},
              "before": {}, "after": {}, "partition": {}}
    fonts = {style: TTFont(SOURCES / f"inter-{style}.woff2") for style in SOURCE_HASHES}
    requested = {style: set(f.getBestCmap()) & policy for style, f in fonts.items()}
    core = set(range(0x20, 0x7F)) | PUNCTUATION
    initial = set(core)
    edges = []
    if not args.strict_split:
        while True:
            previous = set(core)
            for style, font in fonts.items():
                expanded, found = keep_shaping_together(font, requested[style], core & requested[style])
                core |= expanded
                edges += found
            if core == previous:
                break
    args.output.mkdir(parents=True, exist_ok=True)
    css = ["/* Generated by python scripts/subset-fonts.py; commit with the WOFF2 files.",
           " * Rerun after changing content, components, CSS, font settings or sources.",
           " * Shaping-connected Latin letters share the core to preserve kerning.",
           " * No intervening generated fallback face: extended must select this family.",
           " */"]
    for style, weight in [("regular", 400), ("medium", 500)]:
        source = SOURCES / f"inter-{style}.woff2"
        assert digest(source.read_bytes()) == SOURCE_HASHES[style], f"Unreviewed font source: {source}"
        report["before"][style] = inventory(source)
        # Keep the preloaded primary face last: WebKit otherwise computes some
        # underline skip-ink geometry from the unloaded extension's fallback.
        for part, points in [("extended", requested[style] - core),
                             ("core", core & requested[style])]:
            assert points, "A split must not emit an empty font"
            name = f"inter-{style}-{part}.woff2"
            info = generate(source, args.output / name, points, style, part)
            report["after"][name] = info
            css.append("\n@font-face {\n  font-family: 'Inter';\n"
                       f"  src: url('/fonts/{name}') format('woff2');\n"
                       f"  font-style: normal;\n  font-weight: {weight};\n"
                       f"  font-display: swap;\n" +
                       (f"  unicode-range: {info['unicodeRange']};\n" if part == "extended" else
                        "  /* cmap restricts coverage. An explicit core range changes WebKit 1x pixels. */\n") + "}")
        report["partition"][style] = {
            "requested": ranges(requested[style]),
            "missingFromOriginal": ranges((set(range(0xA0, 0x180)) | PUNCTUATION) - set(fonts[style].getBestCmap())),
            "promotedToPreserveShaping": ranges((core - initial) & requested[style]),
            "interactionExamples": edges[:12],
        }
    args.css.parent.mkdir(parents=True, exist_ok=True)
    args.css.write_text("\n".join(css) + "\n")
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    for name, info in report["after"].items():
        print(f"{name}: {info['bytes']:,} bytes; {info['glyphs']} glyphs; {info['codepoints']} codepoints")


if __name__ == "__main__":
    main()
