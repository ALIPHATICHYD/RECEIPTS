// Public demo mode. With OWNER_PASSCODE set, anyone can read the journal and buy
// a sealed pick with their own wallet, but only requests carrying the passcode
// (X-Owner-Passcode) can log, grade, seal, run the agent or spend Tatum credits
// on market search. Without it (local use) everything is open, as before.
import { createHash, timingSafeEqual } from 'crypto'

const passcode = () => process.env.OWNER_PASSCODE ?? ''
const digest = (s) => createHash('sha256').update(s).digest()

// Slow down guessing: after 10 wrong passcodes from one address, refuse for 10 minutes.
const failures = new Map()
const WINDOW_MS = 10 * 60_000

function locked(ip) {
  const f = failures.get(ip)
  return !!f && f.count >= 10 && Date.now() - f.since < WINDOW_MS
}

function noteFailure(ip) {
  if (failures.size > 10_000) failures.clear()
  const f = failures.get(ip)
  if (!f || Date.now() - f.since >= WINDOW_MS) failures.set(ip, { count: 1, since: Date.now() })
  else f.count += 1
}

export function isOwner(req) {
  const expected = passcode()
  if (!expected) return true
  const given = req.get('x-owner-passcode')
  if (!given || locked(req.ip)) return false
  if (timingSafeEqual(digest(given), digest(expected))) return true
  noteFailure(req.ip)
  return false
}

// Visitors may read, and may use the Sui relay their own wallet needs.
const publicRequest = (req) =>
  (req.method === 'GET' && !req.path.startsWith('/prediction/search')) || (req.method === 'POST' && req.path.startsWith('/sui-grpc/'))

export function ownerGuard(req, res, next) {
  if (publicRequest(req) || isOwner(req)) return next()
  res.status(403).json({ error: 'This is a read-only demo. Only the owner can make changes.', code: 'read-only' })
}

export function sessionInfo(req, res) {
  res.json({ readOnly: !!passcode(), owner: isOwner(req) })
}
