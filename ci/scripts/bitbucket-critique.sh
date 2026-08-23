#!/usr/bin/env bash
# One critic (Jekyll, Hyde), on Bitbucket Pipelines. Runs after the review steps,
# and reads their review-*.json files rather than the pull request, so there is no
# comment-read API involved. The pipeline step sets AGENT and AGENT_MODEL.
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

ci/scripts/critique-task.sh "$AGENT" "${REVIEWS_DIR:-.}" "critique-${AGENT}.json" > task.md
ci/scripts/run-agent.sh "$AGENT" task.md
node ci/scripts/post-review.mjs "critique-${AGENT}.json" "$AGENT"
