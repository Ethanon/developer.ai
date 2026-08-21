#!/usr/bin/env bash
# Fail a reviewer job that finished green without posting a review.
#
# `anthropics/claude-code-action` exits 0 whether or not the agent posted, so a
# silent run is indistinguishable from a clean one in the Checks panel. Both ways
# a run goes silent have happened in projects running this kit:
#
#   1. Every tool call is refused, because the workflow passed no --allowedTools.
#      The execution log records permission_denials_count > 0. Observed 2026-08-17:
#      seven turns, $0.46 spent, nothing produced, job green.
#   2. The model reads the task and yields without invoking the reviewer at all.
#      Sonnet 5 follows a "stay silent" or "do not repeat findings" instruction
#      more literally than earlier models and takes it to mean post nothing.
#      Observed twice, most recently as a reviewer that spent two turns and $0.11
#      and posted no review while reporting success.
#
# This check is the durable half of the fix. Prompts drift and model aliases
# float; a job that fails when no review exists keeps telling the truth anyway.
#
# Usage: finalize-agent-review.sh <agent-id> <pr-number> <head-sha> <conclusion> [execution-file]
#
# Outputs (GITHUB_OUTPUT):
#   review_missing  true when the run finished but posted no review, so the
#                   caller can keep the execution log for diagnosis.
#   execution_file  the resolved log path, for that upload step.
set -uo pipefail

agent="$1"
pr="$2"
sha="$3"
conclusion="$4"
execution_file="${5:-}"
[ -n "$execution_file" ] || execution_file="${RUNNER_TEMP:-/tmp}/claude-execution-output.json"

here="$(cd "$(dirname "$0")" && pwd)"

# Denials and duration are diagnostic here rather than decisive: they explain a
# missing review, and the review itself is what decides. Tool-call counts are
# deliberately not consulted — a reviewer's work happens inside a Task subagent,
# so the top-level log always shows the spawn and would always look busy.
denials=0
duration=0
if [ -f "$execution_file" ]; then
  read -r denials duration <<<"$(node -e '
    const fs = require("fs")
    try {
      const raw = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
      const events = Array.isArray(raw) ? raw : [raw]
      const result = events.find((e) => e && e.type === "result") || raw
      process.stdout.write(((result && result.permission_denials_count) || 0) + " " + ((result && result.duration_ms) || 0))
    } catch {
      process.stdout.write("0 0")
    }
  ' "$execution_file" 2>/dev/null || echo "0 0")"
fi

# Unknown when the API cannot be reached. A GitHub hiccup must not fail a
# reviewer that did its job, so only a definite "no" is treated as missing.
posted=unknown
if reviews=$(gh api "repos/${GITHUB_REPOSITORY}/pulls/${pr}/reviews?per_page=100" 2>/dev/null); then
  if printf '%s' "$reviews" | node "${here}/reviewPosted.mjs" "$agent" "$sha"; then posted=yes; else posted=no; fi
fi

review_missing=false
case "$conclusion" in
  success)
    if [ "$posted" = no ]; then
      review_missing=true
      if [ "${denials:-0}" -gt 0 ]; then
        echo "::error::${agent} posted no review — ${denials} tool-permission denials. The workflow is missing --allowedTools."
      else
        echo "::error::${agent} posted no review after ${duration}ms. The reviewer was never invoked; see the uploaded execution log."
      fi
    fi
    ;;
  failure) review_missing=true ;;
esac

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "review_missing=$review_missing" >> "$GITHUB_OUTPUT"
  echo "execution_file=$execution_file" >> "$GITHUB_OUTPUT"
fi

# A silent agent must be red. Green with no review is the failure this exists for.
[ "$review_missing" = true ] && exit 1
exit 0
