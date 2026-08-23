#!/usr/bin/env bash
# One reviewer, on Azure DevOps Pipelines. The matrix leg sets AGENT and
# AGENT_MODEL; everything else is derived here.
set -euo pipefail

: "${AGENT:?set AGENT in the matrix leg}"

npm install -g @anthropic-ai/claude-code >/dev/null
chmod +x ci/scripts/*.sh

export REVIEW_PLATFORM=azure
export AGENT_MODEL="${AGENT_MODEL:-claude-sonnet-5}"
export AGENT_EFFORT="${AGENT_EFFORT:-medium}"
# No Edit. Every reviewer in this kit is read-only, and one that cannot write
# cannot rewrite the code it is judging. Write covers the review file only.
export AGENT_TOOLS="${AGENT_TOOLS:-Bash,Read,Grep,Glob,WebSearch,WebFetch,Write}"

# post-review.mjs reads plain names; Azure exports these as SYSTEM_* and BUILD_*
# already, but the collection URI arrives under two different names depending on
# the agent version, so normalise it here rather than in the poster.
export SYSTEM_COLLECTIONURI="${SYSTEM_COLLECTIONURI:-${SYSTEM_TEAMFOUNDATIONCOLLECTIONURI:-}}"
export PR_ID="${SYSTEM_PULLREQUEST_PULLREQUESTID:?not a pull-request build}"

target_branch="${SYSTEM_PULLREQUEST_TARGETBRANCH#refs/heads/}"
git fetch origin "$target_branch"
base="$(git merge-base "origin/${target_branch}" HEAD)"

export REVIEW_TARGET="pull request ${PR_ID} in ${BUILD_REPOSITORY_NAME}"
export DIFF_COMMAND="git diff ${base}...HEAD"

ci/scripts/review-task.sh "$AGENT" "review-${AGENT}.json" > task.md
ci/scripts/run-agent.sh "$AGENT" task.md
node ci/scripts/post-review.mjs "review-${AGENT}.json" "$AGENT"
