/**
 * Which ports and which names belong to this checkout.
 *
 * A reference implementation of the mechanism in SKILL.md. Copy it into your project's scripts
 * directory and change `BASE_PORTS` to the ports your project actually serves on; everything else is
 * project-agnostic. No dependencies, deliberately — this is the file that has to work in a worktree
 * whose install has not run yet.
 *
 * Identity is derived rather than registered. A checkout is identified by its own directory, so the
 * same checkout resolves to the same ports every time, and there is nothing to clean up when a session
 * dies. The main checkout keeps the plain ports and the plain names it always had, so nothing about
 * the single-session path changes.
 */
import { connect } from 'node:net'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** Change these. What the main checkout serves on, one entry per long-running process. */
export const BASE_PORTS = { web: 3000, api: 8080, database: 5432 }

/** Change this. Prefixes anything else a checkout starts and could collide on: a container, a VM image, a database. */
export const NAME_BASE = 'app'

/**
 * All ports move together, so one checkout's ports share a prefix — 3100, 8180 and 5532 are one
 * session's whole set — and no two of them can ever be handed the same number. Scanning each service
 * independently cannot promise that: the ranges overlap, so a port one service has claimed but not yet
 * bound reads as free to the next service's scan.
 */
const STRIDE = 100

/** Enough for every session a repo of this size expects, and few enough that a runaway scan stops quickly. */
const SLOTS = 16

/** Written where it is read from, so two commands in the same checkout cannot disagree about it. */
const PORT_FILE = '.ports'

/** One file per slot, in the repository every checkout shares, because a claim has to be exclusive somewhere. */
const SLOT_DIR = '.ports.d'

const NAMES = Object.keys(BASE_PORTS)

/**
 * `<repo>/.worktrees/<name>`, or a tool's own directory — `.claude/worktrees/`, `.codex/worktrees/`.
 * Which tool made a worktree says nothing about whether it needs its own ports, and matching only one
 * tool's spelling silently puts every other tool's worktree on the main checkout's ports.
 *
 * Both separators, because this runs on Windows and on Linux CI.
 */
const HOLDER = /[\\/]\.(?:[^\\/]+[\\/])?worktrees[\\/]/

export const isWorktree = (root) => HOLDER.test(`${root}/`)

/** The checkout every worktree hangs off, which is where the slot register lives. */
export const repoRoot = (root) => root.split(HOLDER)[0]

/**
 * Deliberately not `basename`. `node:path` resolves to the *host's* rules, so on Linux a backslash is
 * an ordinary character and a Windows path comes back whole — which names a worktree after its entire
 * path. Both spellings reach this code.
 */
const lastSegment = (path) =>
  path
    .split(/[\\/]/)
    .filter(Boolean)
    .pop() ?? ''

/** Most tools that take a name accept letters, digits, dots, underscores and dashes. A branch name holds more. */
export const sanitise = (name) =>
  name
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

/** What this checkout calls anything it starts: a container, a VM image, a database, a browser profile. */
export const nameFor = (root) => (isWorktree(root) ? `${NAME_BASE}-${sanitise(lastSegment(root))}` : NAME_BASE)

/** The ports a slot hands out. Slot 0 is what a single session has always used. */
export const portsAt = (slot) => Object.fromEntries(NAMES.map((name) => [name, BASE_PORTS[name] + slot * STRIDE]))

/**
 * Asked by connecting rather than by binding. Binding looks like the obvious test and is wrong on
 * Windows: `SO_REUSEADDR` is the default there, so a second bind to a port another process is already
 * listening on succeeds. A refused connection is the only answer that means nobody is home.
 */
const isFree = (port) =>
  new Promise((done) => {
    const socket = connect({ port, host: '127.0.0.1' })
    const settle = (open) => {
      socket.destroy()
      done(open)
    }

    socket.setTimeout(1000)
    socket.once('connect', () => settle(false))
    socket.once('timeout', () => settle(false))
    socket.once('error', (error) => settle(error.code === 'ECONNREFUSED'))
  })

const allFree = async (ports) => (await Promise.all(ports.map(isFree))).every(Boolean)

const portFile = (root) => join(root, PORT_FILE)

/** What a checkout wrote down, or null when it has never claimed or the file says something unusable. */
function stored(root) {
  const file = portFile(root)
  if (!existsSync(file)) return null

  const read = Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line) => /^(\w+)=(\d+)$/.exec(line.trim()))
      .filter(Boolean)
      .map((match) => [match[1], Number(match[2])]),
  )

  return NAMES.every((name) => read[name] > 0) ? read : null
}

/**
 * Takes slot `n` for this checkout, or says who holds it.
 *
 * **The exclusive create is the whole of the lock.** Probing the ports and then writing the claim is a
 * check and an act with a gap between them: two checkouts starting in the same millisecond both find
 * the ports free, and both write themselves onto the same numbers before either binds — which is
 * precisely the simultaneous start this file exists for. Only one of them can *create* a file.
 *
 * A slot whose owner is no longer on disk is a worktree that has been removed, so it is cleared and
 * then competed for the same exclusive way rather than written over.
 */
function takeSlot(dir, slot, root) {
  const file = join(dir, String(slot))
  const claim = () => {
    try {
      writeFileSync(file, `${resolve(root)}\n`, { flag: 'wx' })

      return 'taken'
    } catch {
      return 'held'
    }
  }

  if (claim() === 'taken') return 'taken'

  const owner = (() => {
    try {
      return readFileSync(file, 'utf8').trim()
    } catch {
      return ''
    }
  })()

  if (owner && resolve(owner) === resolve(root)) return 'ours'
  if (owner && existsSync(owner)) return 'held'

  rmSync(file, { force: true })

  return claim()
}

/**
 * Where this checkout starts looking, derived from its own directory, so two worktrees do not queue up
 * behind each other for the same slot on every cold start. Only a starting point: which checkout
 * actually gets a slot is settled by the exclusive create rather than by this.
 *
 * The main checkout is always slot 0 and worktrees never are, so a single session keeps the ports it
 * has always used and cannot be pushed off them.
 */
const preferredSlot = (root) =>
  isWorktree(root) ? 1 + ([...lastSegment(root)].reduce((hash, letter) => (hash * 31 + letter.charCodeAt(0)) % 1e6, 7) % (SLOTS - 1)) : 0

/** Which slot a recorded set of ports came from, or null when it is not one this scheme hands out. */
function slotOf(ports) {
  const slot = (ports[NAMES[0]] - BASE_PORTS[NAMES[0]]) / STRIDE

  return Number.isInteger(slot) && slot >= 0 && slot < SLOTS ? slot : null
}

/**
 * The ports this checkout serves on. Read by every command; claimed by the ones that actually bind
 * something. Without a claim this answers what was chosen before, or what this checkout would choose,
 * which is the right answer for one that has never served anything: there is nothing on any port to
 * find.
 */
export async function portsFor(root, { claim = false } = {}) {
  const already = stored(root)
  if (already && !claim) return already
  if (!claim) return portsAt(preferredSlot(root))

  const dir = join(repoRoot(root), SLOT_DIR)
  mkdirSync(dir, { recursive: true })

  // The slot held last time is asked for first, so a checkout keeps its ports across restarts and any
  // address written into a config file stays true. Failing that, where this directory prefers to start.
  const first = (already && slotOf(already)) ?? preferredSlot(root)

  for (let step = 0; step < SLOTS; step += 1) {
    const slot = (first + step) % SLOTS
    const held = takeSlot(dir, slot, root)
    if (held === 'held') continue

    const ports = portsAt(slot)

    // A slot already ours is kept whatever is listening on it: this checkout's own server answering on
    // this checkout's own port is the normal case, and reading a busy port as proof the slot was lost
    // moves a session off itself. A slot newly taken has to be clear of everything, including whatever
    // on this machine has nothing to do with this project.
    if (held === 'taken' && !(await allFree(Object.values(ports)))) {
      rmSync(join(dir, String(slot)), { force: true })
      continue
    }

    writeFileSync(portFile(root), `${NAMES.map((name) => `${name}=${ports[name]}`).join('\n')}\n`)

    return ports
  }

  throw new Error(`all ${SLOTS} port slots are taken. Something is holding them.`)
}
