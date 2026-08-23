#!/usr/bin/env bash
# One audit agent, on Bitbucket Pipelines.
set -euo pipefail

: "${AGENT:?set AGENT in the pipeline step}"

npm install -g @anthropic-ai/claude-code >/dev/null
chmod +x ci/scripts/*.sh
mkdir -p .claude/reports

export AGENT_MODEL="${AGENT_MODEL:-claude-sonnet-5}"
export AGENT_EFFORT="${AGENT_EFFORT:-medium}"
export AGENT_TOOLS="Bash,Read,Grep,Glob,WebSearch,WebFetch,Write,Edit"

cat > task.md <<'TASK'
---

TASK: Run the audit defined above against this repository now. Write the timestamped
report under .claude/reports/ and reply with only the report path. A report that exists
only in this runner is gone when the job ends, so write the file to the working tree.
TASK

ci/scripts/run-agent.sh "$AGENT" task.md
