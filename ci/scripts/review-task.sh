#!/usr/bin/env bash
# Emit the TASK block appended to a reviewer's spec on non-GitHub platforms.
#
# On GitHub the reviewers post through the GitHub MCP tools, so the task tells
# them to call `mcp__github__pull_request_review_write`. No such tool exists on
# GitLab, Bitbucket, or Azure DevOps, so here the agent writes a JSON file and
# `post-review.mjs` does the posting. Same contract, different last mile.
#
# Splitting write from post is not a workaround; it is better. The agent needs no
# network credential, an inline comment that the API rejects can fall back to an
# unanchored one, and the file is still on disk when a run needs diagnosing.
#
# Usage:  review-task.sh <agent-id> <output-path>
#
# Environment:
#   REVIEW_TARGET  what to call the thing under review ("merge request !42")
#   DIFF_COMMAND   how the agent gets the diff, default a merge-base diff
set -euo pipefail

agent="${1:?usage: review-task.sh <agent-id> <output-path>}"
out="${2:?usage: review-task.sh <agent-id> <output-path>}"
target="${REVIEW_TARGET:-this change}"
diff_command="${DIFF_COMMAND:-git diff origin/\$TARGET_BRANCH...HEAD}"

cat <<TASK_EOF
---

TASK: You are the reviewer defined above. Review ${target} right now. This is a live
change, not a hypothetical.

Get the diff with:

    ${diff_command}

**Write your review to \`${out}\` and write nothing anywhere else.** The file is JSON:

    {
      "summary": "your header banner, then your overall read",
      "comments": [
        { "path": "src/thing.ts", "line": 42, "body": "one finding" }
      ]
    }

- \`summary\` is required and must open with your header banner, so a reader can tell
  which reviewer is speaking.
- \`comments\` may be empty. Omit \`path\` and \`line\` for a finding that has no single
  line, and it posts unanchored.
- \`line\` is a line number in the new version of the file.

**Always write the file, including when you found nothing.** A "stay silent" or "nothing
in my domain" rule means a one-line summary saying so. It never means writing no file.
"Do not repeat existing findings" means do not re-list them in your body; it never means
produce no output.

A run that ends without this file is treated as a failed run, not a clean review, because
from the outside those two look identical.

Reply with only the path you wrote.
TASK_EOF
