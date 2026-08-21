#!/usr/bin/env python3
"""Flag the mechanically-checkable parts of the plain-language standard.

The standard is "Write So Anyone Can Read It" in engineering/ENGINEERING_PRINCIPLES.md,
which applies ISO 24495-1:2023. Four of its seven rules can be checked by a script:

    Rule 2  One idea per sentence      -> em-dash splices, very long sentences
    Rule 5  No idioms or metaphors     -> a list of the ones that recur here
    Rule 7  Name the thing you mean    -> sentences opening with It / This / That

Rules 1, 3, 4 and 6 need a reader. This script does not replace one.

Usage:
    python scripts/check_plain_language.py            # summary per file
    python scripts/check_plain_language.py --details  # every hit with line numbers
    python scripts/check_plain_language.py path.md    # one file

Exit code is always 0. This reports; it does not gate.
"""

import glob
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

IDIOMS = [
    "belt and braces", "out of the gate", "punching above",
    "low-hanging fruit", "move the needle", "boil the ocean",
    "bang for the buck", "silver bullet", "rabbit hole", "north star",
    "secret sauce", "table stakes", "heavy lifting", "circle back",
    "in the weeds", "ducks in a row", "foot-gun", "footgun",
    "drink from the firehose", "throw over the wall", "bite you",
    "shoot yourself in the foot", "hand-wave", "hand wave",
]

SENTENCE_WORD_LIMIT = 40


def scan(path):
    """Return (rule, line_number, evidence) for each hit in one file."""
    hits = []
    lines = io.open(path, encoding="utf-8").read().split("\n")
    in_code = False

    for number, line in enumerate(lines, 1):
        if line.lstrip().startswith("```"):
            in_code = not in_code
            continue
        if in_code or line.lstrip().startswith(("|", ">", "<!--")):
            continue

        stripped = line.strip()
        if not stripped:
            continue

        if "—" in line:
            hits.append(("em-dash", number, stripped[:90]))

        lowered = line.lower()
        for idiom in IDIOMS:
            if idiom in lowered:
                hits.append(("idiom", number, idiom))

        # Rule 7: a sentence that opens by pointing backwards.
        prose = re.sub(r"^[\-\*\d\.\s]+", "", stripped)
        prose = re.sub(r"^\*\*[^*]+\*\*\.?\s*", "", prose)
        if re.match(r"^(It|This|That|These|Those)\s+(is|are|was|were|means|makes|gives)\b", prose):
            hits.append(("points-backwards", number, prose[:70]))

        # Rule 2: sentences long enough to hold more than one idea.
        for sentence in re.split(r"(?<=[.!?])\s+", prose):
            words = len(sentence.split())
            if words > SENTENCE_WORD_LIMIT:
                hits.append(("long-sentence", number, "%d words: %s" % (words, sentence[:60])))

    return hits


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    details = "--details" in sys.argv

    if args:
        targets = args
    else:
        targets = sorted(
            glob.glob(os.path.join(ROOT, "*.md"))
            + glob.glob(os.path.join(ROOT, "engineering", "*.md"))
            + glob.glob(os.path.join(ROOT, "agents", "**", "*.md"), recursive=True)
            + glob.glob(os.path.join(ROOT, "templates", "**", "*.md"), recursive=True)
            + glob.glob(os.path.join(ROOT, "examples", "**", "*.md"), recursive=True)
            + glob.glob(os.path.join(ROOT, "skills", "**", "*.md"), recursive=True)
        )

    totals = {}
    grand = 0
    for path in targets:
        hits = scan(path)
        if not hits:
            continue
        rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
        counts = {}
        for rule, _, _ in hits:
            counts[rule] = counts.get(rule, 0) + 1
            totals[rule] = totals.get(rule, 0) + 1
        grand += len(hits)
        summary = "  ".join("%s:%d" % (k, v) for k, v in sorted(counts.items()))
        print("%-46s %s" % (rel, summary))
        if details:
            for rule, number, evidence in hits:
                print("      %-18s %s:%d  %s" % (rule, rel, number, evidence))

    print()
    print("TOTAL %d hits: %s" % (grand, "  ".join("%s:%d" % (k, v) for k, v in sorted(totals.items()))))
    return 0


if __name__ == "__main__":
    sys.exit(main())
