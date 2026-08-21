#!/usr/bin/env node
// Ground truth for "did this reviewer actually post?", used by
// .github/scripts/finalize-agent-review.sh to turn a silent run red.
//
// The execution log cannot answer it. A reviewer's real work happens inside a
// Task subagent, so the top-level log shows at least one tool call — the spawn —
// even when the subagent posts nothing, and the subagent's own review-post lives
// in an execution context the top-level log never captures. The only reliable
// signal is whether a review carrying this agent's header exists on the PR at
// this head SHA.
//
// Usage: gh api repos/O/R/pulls/<n>/reviews | node scripts/reviewPosted.mjs <agentId> <sha>
// Exit 0 when a matching review exists on that SHA, 1 when not, 2 on bad args.

import { fileURLToPath } from 'node:url'

/**
 * `bob_engineering` -> `Bob`. Every reviewer body leads with `### <Name> — ...`,
 * where the name is the capitalised first segment of the agent id.
 */
export function agentDisplayName(agentId) {
  const first = String(agentId).split('_')[0] ?? ''
  return first.charAt(0).toUpperCase() + first.slice(1)
}

/**
 * True when some review was submitted on `sha` and its body leads a line with
 * this agent's `### <Name>` header. Word-bounded, so `### Bob` never matches a
 * future `### Bobby`.
 */
export function reviewPostedBy(reviews, agentId, sha) {
  const name = agentDisplayName(agentId)
  if (name.length === 0) return false
  const header = new RegExp('^### ' + name + '\\b', 'm')
  const list = Array.isArray(reviews) ? reviews : []
  return list.some((review) => review && review.commit_id === sha && typeof review.body === 'string' && header.test(review.body))
}

async function main() {
  const [agentId, sha] = process.argv.slice(2)
  if (agentId === undefined || sha === undefined) {
    console.error('usage: reviewPosted.mjs <agentId> <sha>  (reviews JSON on stdin)')
    process.exit(2)
  }

  let raw = ''
  for await (const chunk of process.stdin) raw += chunk

  let reviews
  try {
    reviews = JSON.parse(raw.trim() || '[]')
  } catch {
    reviews = []
  }

  process.exit(reviewPostedBy(reviews, agentId, sha) ? 0 : 1)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
