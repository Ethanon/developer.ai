// Post a reviewer's findings to a merge or pull request, then fail when nothing
// was posted. GitLab, Bitbucket, and Azure DevOps.
//
// This is the non-GitHub half of the guard in
// `workflows/scripts/finalize-agent-review.sh`, and it exists for the same
// reason. An agent that crashed, ran out of turns, or decided it had nothing to
// say produces exactly what a clean review produces: no comments. You cannot
// tell "found nothing" from "never ran", and the failure runs in the dangerous
// direction, because you merge believing the diff was reviewed. A job that fails
// when no comment exists keeps telling the truth after prompts drift and model
// aliases float.
//
// Node rather than a shell pipeline, because node is already present: the runner
// installs the Claude Code CLI with npm. Adding a jq or python3 dependency would
// make the job fail on whichever base image lacks it, which is a worse failure
// than the one this file prevents.
//
// Usage:  node post-review.mjs <review-json> <agent-id>
//
// The review file, written by the agent:
//
//   { "summary": "...", "comments": [ { "path": "...", "line": 12, "body": "..." } ] }
//
// An empty `comments` array is valid and posts the summary alone. A missing or
// unparseable file is not.

import { readFileSync } from 'node:fs'

const [reviewPath, agent] = process.argv.slice(2)
const platform = process.env.REVIEW_PLATFORM

function fail(message) {
  console.error(`ERROR: ${message}`)
  process.exit(1)
}

if (!reviewPath || !agent) fail('usage: post-review.mjs <review-json> <agent-id>')
if (!platform) fail('REVIEW_PLATFORM must be gitlab, bitbucket, or azure')

let review
try {
  review = JSON.parse(readFileSync(reviewPath, 'utf8'))
} catch (error) {
  fail(
    `${agent} produced no readable review at ${reviewPath} (${error.message}).\n` +
      'A run that finishes without writing findings is a silent agent, not a clean\n' +
      'review. Check the job log for a permission denial or an early exit.',
  )
}

const summary = (review.summary ?? '').trim()
if (!summary) fail(`${agent} wrote a review with no summary.`)
const comments = Array.isArray(review.comments) ? review.comments : []

function required(...names) {
  const missing = names.filter((n) => !process.env[n])
  if (missing.length) fail(`${platform} needs these variables set: ${missing.join(', ')}`)
  return names.map((n) => process.env[n])
}

// Each platform turns (body, path, line) into a request. Inline placement is
// where the three APIs actually differ; the unanchored comment is nearly the
// same call everywhere.
const platforms = {
  gitlab() {
    const [token, api, project, iid] = required(
      'GITLAB_TOKEN', 'CI_API_V4_URL', 'CI_PROJECT_ID', 'CI_MERGE_REQUEST_IID',
    )
    return (body, path, line) => {
      const payload = { body }
      if (path && line) {
        const [base, start, head] = required('DIFF_BASE_SHA', 'DIFF_START_SHA', 'DIFF_HEAD_SHA')
        payload.position = {
          position_type: 'text',
          new_path: path,
          new_line: Number(line),
          base_sha: base,
          start_sha: start,
          head_sha: head,
        }
      }
      return {
        url: `${api}/projects/${encodeURIComponent(project)}/merge_requests/${iid}/discussions`,
        headers: { 'PRIVATE-TOKEN': token },
        payload,
      }
    }
  },

  bitbucket() {
    const [token, workspace, repo, pr] = required(
      'BITBUCKET_TOKEN', 'BITBUCKET_WORKSPACE', 'BITBUCKET_REPO_SLUG', 'BITBUCKET_PR_ID',
    )
    return (body, path, line) => {
      const payload = { content: { raw: body } }
      if (path && line) payload.inline = { path, to: Number(line) }
      return {
        url: `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests/${pr}/comments`,
        headers: { Authorization: `Bearer ${token}` },
        payload,
      }
    }
  },

  azure() {
    const [token, collection, project, repo, pr] = required(
      'AZURE_DEVOPS_TOKEN', 'SYSTEM_COLLECTIONURI', 'SYSTEM_TEAMPROJECT',
      'BUILD_REPOSITORY_NAME', 'PR_ID',
    )
    const auth = Buffer.from(`:${token}`).toString('base64')
    return (body, path, line) => {
      // commentType 1 is a plain text comment; status 1 leaves the thread active.
      const payload = { comments: [{ parentCommentId: 0, content: body, commentType: 1 }], status: 1 }
      if (path && line) {
        const filePath = path.startsWith('/') ? path : `/${path}`
        payload.threadContext = {
          filePath,
          rightFileStart: { line: Number(line), offset: 1 },
          rightFileEnd: { line: Number(line), offset: 1 },
        }
      }
      const base = collection.endsWith('/') ? collection : `${collection}/`
      return {
        url: `${base}${project}/_apis/git/repositories/${repo}/pullRequests/${pr}/threads?api-version=7.1`,
        headers: { Authorization: `Basic ${auth}` },
        payload,
      }
    }
  },
}

if (!platforms[platform]) fail(`unknown REVIEW_PLATFORM: ${platform}`)
const build = platforms[platform]()

async function post(body, path, line) {
  const { url, headers, payload } = build(body, path, line)
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (response.ok) return true
  console.error(`  ${response.status} ${response.statusText}: ${(await response.text()).slice(0, 400)}`)
  return false
}

let posted = 0

// The summary goes up before any inline comment, so a partial failure still
// leaves a reader something that says which agent ran and what it concluded.
if (await post(summary)) {
  posted += 1
} else {
  fail(
    `${agent}: the summary comment failed to post. The finding is lost, so this\n` +
      'fails rather than reporting a review nobody can read.',
  )
}

for (const comment of comments) {
  const { path, line, body } = comment
  if (!body) continue
  if (await post(body, path, line)) {
    posted += 1
    continue
  }
  // An inline post can fail for a reason that is nobody's fault: the line moved,
  // or the API rejects a position outside the diff. Fall back to an unanchored
  // comment rather than dropping a real finding on the floor.
  console.error(`WARNING: inline post failed for ${path}:${line}, retrying unanchored.`)
  if (await post(`\`${path}:${line}\` ${body}`)) posted += 1
  else console.error(`WARNING: fallback also failed for ${path}:${line}. Finding lost.`)
}

if (posted === 0) {
  fail(
    `${agent} posted nothing. A silent agent and a clean review look identical on\n` +
      'the request, so this fails the job.',
  )
}

console.error(`${agent}: posted ${posted} comment(s).`)
