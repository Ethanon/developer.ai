#!/usr/bin/env bash
# Emit the TASK block for a critic agent (Jekyll, Hyde) on non-GitHub platforms.
#
# Critics need two things: the diff, and what the first wave found. On GitHub
# they get the second by reading review comments back off the pull request. Here
# they read the first wave's review files directly, which is the better half of
# the trade: the findings arrive already structured, with the path and line each
# one anchored to, so a critique threads onto the right line without parsing a
# comment body to work out where it was.
#
# This is why the critics are a second stage rather than a fourth parallel job.
# There is nothing to critique until the first wave has written its files.
#
# Usage:  critique-task.sh <agent-id> <reviews-dir> <output-path>
set -euo pipefail

agent="${1:?usage: critique-task.sh <agent-id> <reviews-dir> <output-path>}"
reviews_dir="${2:?usage: critique-task.sh <agent-id> <reviews-dir> <output-path>}"
out="${3:?usage: critique-task.sh <agent-id> <reviews-dir> <output-path>}"
target="${REVIEW_TARGET:-this change}"
diff_command="${DIFF_COMMAND:-git diff origin/\$TARGET_BRANCH...HEAD}"

# List what the first wave actually produced, so the agent is told which files
# exist rather than guessing at names. An empty list is a real state: every
# first-wave reviewer may have failed, and the agent must be told that plainly.
# Recursive, because artifacts land differently per platform: at the working
# directory on GitLab and Bitbucket, one directory deeper per artifact name on
# Azure. A find covers all three without the caller having to care.
found="$(find "$reviews_dir" -name 'review-*.json' -type f 2>/dev/null | sed 's/^/    /')"

cat <<TASK_EOF
---

TASK: You are the critic defined above. Critique the first-wave reviews on ${target} right
now. This is a live change, not a hypothetical.

Get the diff with:

    ${diff_command}

**The first-wave findings are on disk, not on the request.** Read every file below. Each is
JSON with a \`summary\` and a \`comments\` array, and each comment carries the \`path\` and
\`line\` it was anchored to:

${found:-    (none: no first-wave reviewer produced a file)}

Treat those files exactly as your spec treats posted reviews. Where your spec says to read
existing reviews and inline comments, that is these files. Where it says to anchor your
critique to the line an upstream finding sits on, use that finding's \`path\` and \`line\`.
Where it names the upstream reviewer, the agent id is in the filename.

**Write your critique to \`${out}\` and write nothing anywhere else.** Same JSON shape:

    {
      "summary": "your header banner, then your overall read",
      "comments": [
        { "path": "src/thing.ts", "line": 42, "body": "**<You> re: alice:** ..." }
      ]
    }

- \`summary\` is required and must open with your header banner.
- \`comments\` may be empty when your spec's silence conditions are met.
- Omit \`path\` and \`line\` for a finding with no single line, and it posts unanchored.

**Always write the file, including when you have nothing to say.** Your spec's "no notes" or
"stay silent" case means a one-line summary saying so. It never means writing no file. If no
first-wave file exists at all, say that in the summary rather than inventing findings: it
means the reviewers failed, and that is worth a reader knowing.

A run that ends without this file is treated as a failed run, not a quiet one, because from
the outside those two look identical.

Reply with only the path you wrote.
TASK_EOF
