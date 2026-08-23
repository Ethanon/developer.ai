#!/usr/bin/env bash
# Run one agent spec through the Claude Code CLI. Platform-neutral.
#
# On GitHub, `anthropics/claude-code-action` does this. Nothing equivalent exists
# for GitLab, Bitbucket, or Azure DevOps, so this script is the equivalent: it
# loads a spec, strips the frontmatter, and feeds the body as the top-level
# prompt so the model runs AS the agent rather than being asked to invoke it.
#
# That distinction is the whole reason the script exists. A prompt that says
# "invoke the alice_security subagent" gives the model a decision to make, and
# the decision it makes is often "I have nothing to add", which produces a green
# job and no review. Feeding the spec body directly removes the choice.
#
# Usage:
#   run-agent.sh <agent-id> [task-file]
#
# Environment:
#   CLAUDE_CODE_OAUTH_TOKEN  required
#   AGENT_MODEL              default claude-sonnet-5
#   AGENT_EFFORT             default medium
#   AGENT_TOOLS              default read-only set
#   AGENT_DIR                default .claude/agents
#
# The task file, when given, is appended after the spec under a TASK heading.
# Anything the agent must know that is not in its spec belongs there: the pull
# request number, the output path, the platform it is posting to.
set -euo pipefail

agent="${1:?usage: run-agent.sh <agent-id> [task-file]}"
task_file="${2:-}"

agent_dir="${AGENT_DIR:-.claude/agents}"
spec="${agent_dir}/${agent}.md"
model="${AGENT_MODEL:-claude-sonnet-5}"
effort="${AGENT_EFFORT:-medium}"
tools="${AGENT_TOOLS:-Bash,Read,Grep,Glob,WebSearch,WebFetch,Write}"

if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  echo "ERROR: CLAUDE_CODE_OAUTH_TOKEN is not set." >&2
  echo "Run 'claude setup-token' locally and add the value as a masked CI variable." >&2
  exit 1
fi

if [ ! -f "$spec" ]; then
  echo "ERROR: no spec at ${spec}" >&2
  echo "The agent files ship in .claude/agents/. That directory name is Claude Code's" >&2
  echo "requirement; set AGENT_DIR if yours live elsewhere." >&2
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "Installing the Claude Code CLI." >&2
  npm install -g @anthropic-ai/claude-code >/dev/null
fi

prompt_file="$(mktemp)"
trap 'rm -f "$prompt_file"' EXIT

# Drop everything up to and including the second `---`, which is the YAML
# frontmatter. What remains is the spec body, which is the prompt.
awk 'BEGIN{c=0} /^---$/ && c<2 {c++; next} c>=2{print}' "$spec" > "$prompt_file"

if [ -n "$task_file" ]; then
  [ -f "$task_file" ] || { echo "ERROR: no task file at ${task_file}" >&2; exit 1; }
  printf '\n\n---\n\n' >> "$prompt_file"
  cat "$task_file" >> "$prompt_file"
fi

echo "Running ${agent} on ${model} (effort ${effort})." >&2

# --allowedTools is required, not a hardening extra. Without it every tool call
# is denied, the agent produces nothing, and the job still exits 0.
claude -p "$(cat "$prompt_file")" \
  --model "$model" \
  --effort "$effort" \
  --allowedTools "$tools"
