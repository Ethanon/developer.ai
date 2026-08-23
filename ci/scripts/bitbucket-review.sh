#!/usr/bin/env bash
# One reviewer, on Bitbucket Pipelines. The pipeline file sets AGENT and
# AGENT_MODEL; everything else is derived here so the YAML stays two lines
# per step.
set -euo pipefail

: "${AGENT:?set AGENT in the pipeline step}"

npm install -g @anthropic-ai/claude-code >/dev/null
chmod +x ci/scripts/*.sh

export REVIEW_PLATFORM=bitbucket
export AGENT_MODEL="${AGENT_MODEL:-claude-sonnet-5}"
export AGENT_EFFORT="${AGENT_EFFORT:-medium}"
# No Edit. Every reviewer in this kit is read-only, and one that cannot write
# cannot rewrite the code it is judging. Write covers the review file only.
export AGENT_TOOLS="${AGENT_TOOLS:-Bash,Read,Grep,Glob,WebSearch,WebFetch,Write}"

git fetch origin "$BITBUCKET_PR_DESTINATION_BRANCH"
base="$(git merge-base "origin/${BITBUCKET_PR_DESTINATION_BRANCH}" HEAD)"

export REVIEW_TARGET="pull request #${BITBUCKET_PR_ID} in ${BITBUCKET_REPO_FULL_NAME}"
export DIFF_COMMAND="git diff ${base}...HEAD"

ci/scripts/review-task.sh "$AGENT" "review-${AGENT}.json" > task.md
ci/scripts/run-agent.sh "$AGENT" task.md
node ci/scripts/post-review.mjs "review-${AGENT}.json" "$AGENT"
