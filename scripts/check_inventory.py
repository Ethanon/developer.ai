#!/usr/bin/env python3
"""Verify the docs still describe the kit that actually ships.

Every check here exists because the corresponding claim drifted at least once.
Run it locally before opening a PR, or wire it into CI:

    python scripts/check_inventory.py

Exit code 0 means the docs and the filesystem agree. Non-zero prints one line
per disagreement, in `file: problem` form.
"""

import glob
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(rel):
    with io.open(os.path.join(ROOT, rel), encoding="utf-8") as handle:
        return handle.read()


def agent_files(subdir):
    pattern = os.path.join(ROOT, "agents", subdir, "*.md")
    return sorted(os.path.basename(p) for p in glob.glob(pattern))


def stem(filename):
    return filename[:-3]


def check_agents_listed_in_readme(failures):
    """Every shipped agent appears in the readme's inventory tables."""
    readme = read("readme.md")
    for subdir in ("pr-review", "audits", "backlog"):
        for filename in agent_files(subdir):
            if filename not in readme and stem(filename) not in readme:
                failures.append(
                    "readme.md: agent `%s` ships but is not in the inventory" % filename
                )


def check_readme_counts(failures):
    """The parenthesised counts in the readme headings match reality."""
    readme = read("readme.md")
    expected = {
        r"### PR review pipeline \(up to (\d+) agents\)": len(agent_files("pr-review")),
        r"### Weekly audits \((\d+) agents\)": len(agent_files("audits")),
        r"### Backlog automation \((\d+) agents\)": len(agent_files("backlog")),
    }
    for pattern, actual in expected.items():
        match = re.search(pattern, readme)
        if not match:
            failures.append("readme.md: heading matching /%s/ not found" % pattern)
        elif int(match.group(1)) != actual:
            failures.append(
                "readme.md: heading says %s, filesystem has %d (/%s/)"
                % (match.group(1), actual, pattern)
            )


# Root docs that are entry points in their own right, not content to link.
ENTRY_POINTS = {"readme.md", "CLAUDE.md", "LICENSE.md"}


def check_docs_linked(failures):
    """Every doc a reader is meant to find is reachable from readme or CLAUDE.md.

    Covers engineering/ and the root-level guidance docs. A doc nothing links to
    is a doc nobody reads, which is how AGENT_RELIABILITY.md shipped invisible.
    """
    readme = read("readme.md")
    claude = read("CLAUDE.md")

    for path in sorted(glob.glob(os.path.join(ROOT, "engineering", "*.md"))):
        name = os.path.basename(path)
        if name not in readme:
            failures.append("readme.md: engineering/%s is not mentioned" % name)
        if name not in claude:
            failures.append("CLAUDE.md: engineering/%s is not mentioned" % name)

    for path in sorted(glob.glob(os.path.join(ROOT, "*.md"))):
        name = os.path.basename(path)
        if name in ENTRY_POINTS:
            continue
        if name not in readme and name not in claude:
            failures.append(
                "%s is a root doc that neither readme.md nor CLAUDE.md links to" % name
            )


def check_flags_defined(failures):
    """Every applies-when flag used anywhere is defined in the installer table."""
    installer = read("agents/installer.md")
    defined = set(re.findall(r"^\| `([a-z][a-z0-9-]*)`", installer, re.M))
    targets = (
        glob.glob(os.path.join(ROOT, "engineering", "*.md"))
        + glob.glob(os.path.join(ROOT, "agents", "**", "*.md"), recursive=True)
        + glob.glob(os.path.join(ROOT, "templates", "*.md"))
    )
    for path in targets:
        body = io.open(path, encoding="utf-8").read()
        for clause in re.findall(r"applies-when: ([^>]+?) -->", body):
            for flag in re.split(r"\s*\+\s*", clause.strip()):
                if flag and flag not in defined:
                    rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
                    failures.append(
                        "%s: applies-when `%s` is not defined in the installer flag table"
                        % (rel, flag)
                    )


def check_agents_wired(failures):
    """Every agent is reachable from a workflow, or is the installer itself."""
    wiring = read("workflows/pr-review.yml") + read("workflows/scheduled-agents.yml")
    for subdir in ("pr-review", "audits", "backlog"):
        for filename in agent_files(subdir):
            if stem(filename) not in wiring:
                failures.append(
                    "workflows/: agent `%s` ships but no workflow invokes it" % filename
                )


def check_preference_sections_match_installer(failures):
    """Every Personal Preference section is offered as an opt-out by the installer.

    Matched by section name rather than by count. A count check passes whenever
    two mismatched sets happen to be the same size, which is exactly the drift
    this is meant to catch.
    """
    installer = read("agents/installer.md")
    marker = "### Q16 rule-to-section mapping"
    if marker not in installer:
        failures.append("agents/installer.md: Q16 rule-to-section mapping not found")
        return
    offered = installer[installer.index(marker):]

    for rel in ("engineering/ENGINEERING_PRINCIPLES.md", "engineering/PR_WORKFLOW.md"):
        current = None
        for line in read(rel).splitlines():
            heading = re.match(r"^#{2,3} (.+)$", line)
            if heading:
                current = heading.group(1).strip()
            if "tag: Personal Preference" not in line or not current:
                continue
            key = re.split(r"—| - ", current)[0].strip()
            if key and key not in offered:
                failures.append(
                    "%s: section `%s` is tagged Personal Preference but the "
                    "installer Q16 mapping does not offer it as an opt-out"
                    % (rel, current)
                )

def main():
    failures = []
    for check in (
        check_agents_listed_in_readme,
        check_readme_counts,
        check_docs_linked,
        check_flags_defined,
        check_agents_wired,
        check_preference_sections_match_installer,
    ):
        check(failures)

    if failures:
        print("Inventory check failed (%d problem(s)):\n" % len(failures))
        for line in failures:
            print("  " + line)
        return 1

    print("Inventory check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
