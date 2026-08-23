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


# The agent inventory lives in agents/README.md. The root readme links to it
# rather than repeating it, so these two checks read the inventory where it is.
INVENTORY = "agents/README.md"


def check_agents_listed_in_inventory(failures):
    """Every shipped agent appears in the inventory tables."""
    inventory = read(INVENTORY)
    for subdir in ("pr-review", "audits", "backlog"):
        for filename in agent_files(subdir):
            if filename not in inventory and stem(filename) not in inventory:
                failures.append(
                    "%s: agent `%s` ships but is not in the inventory" % (INVENTORY, filename)
                )


def check_inventory_counts(failures):
    """The parenthesised counts in the inventory headings match reality."""
    readme = read(INVENTORY)
    expected = {
        r"### PR review pipeline \(up to (\d+) agents\)": len(agent_files("pr-review")),
        r"### Weekly audits \((\d+) agents\)": len(agent_files("audits")),
        r"### Backlog automation \((\d+) agents\)": len(agent_files("backlog")),
    }
    for pattern, actual in expected.items():
        match = re.search(pattern, readme)
        if not match:
            failures.append("%s: heading matching /%s/ not found" % (INVENTORY, pattern))
        elif int(match.group(1)) != actual:
            failures.append(
                "%s: heading says %s, filesystem has %d (/%s/)"
                % (INVENTORY, match.group(1), actual, pattern)
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


def check_links(failures):
    """Every relative markdown link resolves to a file that exists.

    Fenced blocks are skipped: they hold templates for the adopter's repo, where
    the target will exist and here it will not. This caught a template shipping
    a link to a file that only lives in the kit.
    """
    for path in sorted(glob.glob(os.path.join(ROOT, "**", "*.md"), recursive=True)):
        rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
        if ".git" in rel:
            continue
        base = os.path.dirname(path)
        fenced = False
        for number, line in enumerate(io.open(path, encoding="utf-8"), 1):
            if line.lstrip().startswith("```"):
                fenced = not fenced
                continue
            if fenced:
                continue
            for target in re.findall(r"\]\(([^)#]+?)(?:#[^)]*)?\)", line):
                if target.startswith(("http", "mailto:", "<")):
                    continue
                if not os.path.exists(os.path.normpath(os.path.join(base, target))):
                    failures.append(
                        "%s:%d: link to `%s` does not resolve" % (rel, number, target)
                    )


def check_tool_configs_documented(failures):
    """Every toolconfigs/ file has an install path in its README and the installer."""
    readme = read("toolconfigs/README.md")
    installer = read("agents/installer.md")
    for path in sorted(glob.glob(os.path.join(ROOT, "toolconfigs", "*"))):
        name = os.path.basename(path)
        if name == "README.md":
            continue
        if name not in readme:
            failures.append(
                "toolconfigs/README.md: `%s` ships but has no row" % name
            )
        if name not in installer:
            failures.append(
                "agents/installer.md: toolconfigs/`%s` ships but the install table "
                "does not say where it goes" % name
            )


def check_ci_platforms_documented(failures):
    """Every ci/<platform>/ directory is offered by the installer and explained.

    A pipeline nobody is told about is a pipeline nobody copies, which is how a
    platform ends up shipped and unreachable.
    """
    installer = read("agents/installer.md")
    ci_readme = read("ci/README.md")
    for path in sorted(glob.glob(os.path.join(ROOT, "ci", "*"))):
        name = os.path.basename(path)
        if not os.path.isdir(path) or name == "scripts":
            continue
        if "ci/%s/" % name not in installer:
            failures.append(
                "agents/installer.md: ci/%s/ ships but Q11 does not offer it" % name
            )
        if name not in ci_readme.lower():
            failures.append("ci/README.md: ci/%s/ ships but is not described" % name)


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
        check_agents_listed_in_inventory,
        check_inventory_counts,
        check_docs_linked,
        check_flags_defined,
        check_agents_wired,
        check_preference_sections_match_installer,
        check_links,
        check_tool_configs_documented,
        check_ci_platforms_documented,
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
