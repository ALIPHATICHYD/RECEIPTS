// The learning loop: grades become credibility scores (per source × league) and
// patterns about the user's own journal. Everything is append-only: a new score or
// pattern is a new memory that names the one it supersedes, so the history of how
// Receipts changed its mind stays readable in the memory inspector.
import { memwal, blobExplorerUrl, NAMESPACES } from './memwal-client.mjs'
import { decodePick, decodeGrade, decimalOdds, detectLeague, parseSource } from './picks.mjs'

const CRED_MARKER = 'RECEIPTS_CRED_V1 '
const PROFILE_MARKER = 'RECEIPTS_PROFILE_V1 '

// A segment needs this many graded picks before Receipts calls it a pattern.
const PATTERN_MIN_PICKS = 5
const PATTERN_ROI = 0.15

function decodeMarked(text, marker) {
  const line = text?.split('\n').find((l) => l.startsWith(marker))
  if (!line) return null
  try {
    return JSON.parse(line.slice(marker.length))
  } catch {
    return null
  }
}

export function proof(hit) {
  return { blobId: hit.blob_id, explorerUrl: blobExplorerUrl(hit.blob_id) }
}

export async function recallAll(namespace, query) {
  const result = await memwal().recall({ query, namespace, limit: 100, sort: 'recent' })
  return result.results
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const pct = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`

// ---------- Picks with their latest grade ----------

export async function loadPicks() {
  const [pickHits, gradeHits] = await Promise.all([
    recallAll(NAMESPACES.picks, 'Receipt: tipster picked a side, logged pick'),
    recallAll(NAMESPACES.grades, 'Graded pick won lost pushed'),
  ])

  const picks = new Map()
  for (const hit of pickHits) {
    const pick = decodePick(hit.text)
    if (!pick || picks.has(pick.id)) continue
    pick.league ||= detectLeague(`${pick.event} ${pick.notes}`, pick.category)
    // Picks saved before sources could be links stored the raw URL as the
    // handle ("@https://…"). Read them back as the handle the link names.
    if (/^@https?:\/\//i.test(pick.source)) Object.assign(pick, parseSource(pick.source.slice(1)))
    picks.set(pick.id, { ...pick, ...proof(hit), grade: null })
  }

  for (const hit of gradeHits) {
    const grade = decodeGrade(hit.text)
    const pick = grade && picks.get(grade.pickId)
    if (!pick) continue
    // Newest grade wins, so a mistaken grade is corrected by grading again.
    if (!pick.grade || grade.gradedAt > pick.grade.gradedAt) {
      pick.grade = { ...grade, ...proof(hit) }
      pick.status = grade.result
    }
  }
  return [...picks.values()]
}

// ---------- Credibility ----------

export const credKey = (source, league) => `${source.toLowerCase()}|${league}`

function units(pick) {
  if (pick.status === 'won') return decimalOdds(pick.odds) - 1
  if (pick.status === 'lost') return -1
  return 0
}

// Closing-line value: did the pick beat the price the market settled on?
function clv(pick) {
  if (!pick.grade?.closingOdds) return null
  return decimalOdds(pick.odds) / decimalOdds(pick.grade.closingOdds) - 1
}

export function scoreSource(picks, source, league) {
  const graded = picks.filter(
    (p) => p.source.toLowerCase() === source.toLowerCase() && p.league === league && p.status !== 'pending',
  )
  const won = graded.filter((p) => p.status === 'won').length
  const lost = graded.filter((p) => p.status === 'lost').length
  const push = graded.length - won - lost
  const clvs = graded.map(clv).filter((x) => x !== null)
  return {
    key: credKey(source, league),
    source,
    league,
    n: graded.length,
    won,
    lost,
    push,
    // Win rate pulled toward 50% until there is enough evidence (Beta(2,2) prior),
    // so one lucky call doesn't top the board.
    trust: Math.round((100 * (won + 2)) / (won + lost + 4)),
    roi: graded.length ? graded.reduce((sum, p) => sum + units(p), 0) / graded.length : 0,
    clv: clvs.length ? clvs.reduce((a, b) => a + b, 0) / clvs.length : null,
  }
}

export async function loadCredibility() {
  const hits = await recallAll(NAMESPACES.credibility, 'Credibility update source league trust score')
  const history = []
  for (const hit of hits) {
    const rec = decodeMarked(hit.text, CRED_MARKER)
    if (rec) history.push({ ...rec, text: hit.text.split('\n')[0], ...proof(hit) })
  }
  history.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
  const current = new Map()
  for (const rec of history) if (!current.has(rec.key)) current.set(rec.key, rec)
  return { current, history }
}

export async function writeCredibility(picks, pick, previous) {
  const score = scoreSource(picks, pick.source, pick.league)
  const prevTrust = previous?.trust ?? 50
  const move = score.trust === prevTrust ? `stays at ${score.trust}` : `moved from ${prevTrust} to ${score.trust}`
  const verb = pick.status === 'push' ? 'pushed' : pick.status === 'pending' ? 'had its grade withdrawn' : pick.status
  const sentence =
    `Credibility update: ${score.source} on ${score.league} ${move} after ${pick.event} (${pick.side}) ${verb}. ` +
    `Record ${score.won}W-${score.lost}L-${score.push}P over ${plural(score.n, 'graded pick')}, ${pct(score.roi)} ROI` +
    `${score.clv !== null ? `, ${pct(score.clv)} average closing-line value` : ''}.` +
    `${previous ? ` Supersedes the score in blob ${previous.blobId}.` : ''}`
  const record = {
    ...score,
    prevTrust,
    reason: `${pick.event} (${pick.side}) ${verb}`,
    pickId: pick.id,
    supersedes: previous?.blobId ?? null,
    recordedAt: new Date().toISOString(),
  }
  const accepted = await memwal().remember(`${sentence}\n${CRED_MARKER}${JSON.stringify(record)}`, NAMESPACES.credibility)
  return { record, sentence, jobId: accepted.job_id }
}

// ---------- The user's own patterns and limits ----------

const SEGMENTS = [
  { label: (p) => `${p.league} picks`, key: (p) => `league:${p.league}` },
  { label: (p) => `${p.market} bets`, key: (p) => `market:${p.market.toLowerCase()}` },
  {
    label: (p) => (decimalOdds(p.odds) < 2 ? 'favourites' : 'underdogs'),
    key: (p) => `price:${decimalOdds(p.odds) < 2 ? 'fav' : 'dog'}`,
  },
  {
    label: (p) => `${p.league} ${decimalOdds(p.odds) < 2 ? 'favourites' : 'underdogs'}`,
    key: (p) => `league-price:${p.league}:${decimalOdds(p.odds) < 2 ? 'fav' : 'dog'}`,
  },
]

export function segmentKeys(pick) {
  return SEGMENTS.map((s) => s.key(pick))
}

export function findPatterns(picks) {
  const graded = picks.filter((p) => p.status !== 'pending')
  const groups = new Map()
  for (const p of graded) {
    for (const seg of SEGMENTS) {
      const key = seg.key(p)
      const g = groups.get(key) ?? { key, label: seg.label(p), picks: [] }
      g.picks.push(p)
      groups.set(key, g)
    }
  }
  const patterns = []
  for (const g of groups.values()) {
    if (g.picks.length < PATTERN_MIN_PICKS) continue
    const roi = g.picks.reduce((s, p) => s + units(p), 0) / g.picks.length
    const won = g.picks.filter((p) => p.status === 'won').length
    const lost = g.picks.filter((p) => p.status === 'lost').length
    const verdict = roi <= -PATTERN_ROI ? 'leak' : roi >= PATTERN_ROI ? 'edge' : 'neutral'
    patterns.push({ key: g.key, label: g.label, n: g.picks.length, won, lost, roi, verdict })
  }
  return patterns
}

export async function loadProfile() {
  const hits = await recallAll(NAMESPACES.profile, 'Pattern leak edge limit stop after losses')
  const records = []
  for (const hit of hits) {
    const rec = decodeMarked(hit.text, PROFILE_MARKER)
    if (rec) records.push({ ...rec, text: hit.text.split('\n')[0], ...proof(hit) })
  }
  records.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
  const patterns = new Map()
  let limit = null
  for (const rec of records) {
    if (rec.type === 'limit') limit ??= rec
    else if (rec.type === 'pattern' && !patterns.has(rec.key)) patterns.set(rec.key, rec)
  }
  return { patterns, limit, history: records }
}

// Write a pattern memory only when a segment's verdict changes, so the profile
// reads as a short list of turning points rather than a log of every grade.
export async function writePatternChanges(picks, profile) {
  const writes = []
  for (const pat of findPatterns(picks)) {
    const previous = profile.patterns.get(pat.key)
    if ((previous?.verdict ?? 'neutral') === pat.verdict) continue
    const sentence =
      pat.verdict === 'leak'
        ? `Pattern: ${pat.label} in your journal are losing, ${pat.won}W-${pat.lost}L over ${pat.n} graded picks (${pct(pat.roi)} ROI). Warn before logging more of these.`
        : pat.verdict === 'edge'
          ? `Pattern: ${pat.label} in your journal are winning, ${pat.won}W-${pat.lost}L over ${pat.n} graded picks (${pct(pat.roi)} ROI).`
          : `Pattern: ${pat.label} are back to break-even (${pct(pat.roi)} ROI over ${pat.n} picks); the earlier ${previous.verdict} no longer holds.`
    const record = { type: 'pattern', ...pat, supersedes: previous?.blobId ?? null, recordedAt: new Date().toISOString() }
    await memwal().remember(`${sentence}\n${PROFILE_MARKER}${JSON.stringify(record)}`, NAMESPACES.profile)
    // Keep the in-hand profile current so grading several picks in a row
    // doesn't write the same verdict twice.
    profile.patterns.set(pat.key, { ...record, blobId: previous?.blobId ?? null })
    writes.push(sentence)
  }
  return writes
}

export async function writeLimit(maxDailyLosses, previous) {
  const sentence = maxDailyLosses
    ? `Limit: the user asked to be warned after ${maxDailyLosses} losing picks in one day.`
    : 'Limit: the user removed their daily loss limit.'
  const record = { type: 'limit', maxDailyLosses, supersedes: previous?.blobId ?? null, recordedAt: new Date().toISOString() }
  const accepted = await memwal().remember(`${sentence}\n${PROFILE_MARKER}${JSON.stringify(record)}`, NAMESPACES.profile)
  return { record, sentence, jobId: accepted.job_id }
}

// ---------- Advice ----------
// Rule-based on purpose: every line points at the memory it came from, so anyone
// reading it can open the blob and check why the app said it.

const sameEvent = (a, b) => a.event.toLowerCase().replace(/\s+/g, ' ').trim() === b.event.toLowerCase().replace(/\s+/g, ' ').trim()

export function adviseOpenPicks(picks, credibility, profile) {
  const today = new Date().toISOString().slice(0, 10)
  const lossesToday = picks.filter((p) => p.status === 'lost' && p.grade?.gradedAt?.startsWith(today)).length
  const limit = profile.limit?.maxDailyLosses ? profile.limit : null

  return picks
    .filter((p) => p.status === 'pending')
    .map((pick) => {
      const advice = []
      const cred = credibility.current.get(credKey(pick.source, pick.league))
      const trust = cred?.trust ?? null

      if (cred && cred.n > 0) {
        const tone = cred.trust >= 60 ? 'good' : cred.trust <= 40 ? 'warn' : 'info'
        advice.push({
          tone,
          text: `${pick.source} is ${cred.won}W-${cred.lost}L on ${pick.league} (trust ${cred.trust}, ${pct(cred.roi)} ROI).`,
          memory: { blobId: cred.blobId, explorerUrl: cred.explorerUrl },
        })
      } else {
        advice.push({ tone: 'info', text: `No graded record for ${pick.source} on ${pick.league} yet.` })
      }

      // Disagreement among sources on the same event, weighted by what we remember of them.
      const rivals = picks.filter((p) => p.id !== pick.id && p.status === 'pending' && sameEvent(p, pick) && p.side !== pick.side)
      for (const rival of rivals) {
        const rc = credibility.current.get(credKey(rival.source, rival.league))
        if (!rc || rc.n === 0) continue
        const stronger = trust === null || rc.trust > trust
        advice.push({
          tone: stronger ? 'warn' : 'info',
          text: `${rival.source} (trust ${rc.trust} on ${rival.league}) is on ${rival.side} instead${stronger ? ', and has the better record here' : ''}.`,
          memory: { blobId: rc.blobId, explorerUrl: rc.explorerUrl },
        })
      }

      // One pattern line per pick: the strongest leak if any, else the strongest edge.
      const matched = segmentKeys(pick)
        .map((key) => profile.patterns.get(key))
        .filter((pat) => pat && pat.verdict !== 'neutral')
        .sort((a, b) => (a.verdict === b.verdict ? Math.abs(b.roi) - Math.abs(a.roi) : a.verdict === 'leak' ? -1 : 1))
      for (const pat of matched.slice(0, 1)) {
        advice.push({
          tone: pat.verdict === 'leak' ? 'warn' : 'good',
          text:
            pat.verdict === 'leak'
              ? `Your ${pat.label} are ${pat.won}W-${pat.lost}L (${pct(pat.roi)} ROI). This pick fits that pattern.`
              : `Your ${pat.label} are ${pat.won}W-${pat.lost}L (${pct(pat.roi)} ROI).`,
          memory: { blobId: pat.blobId, explorerUrl: pat.explorerUrl },
        })
      }

      if (limit && lossesToday >= limit.maxDailyLosses) {
        advice.push({
          tone: 'warn',
          text: `You've had ${lossesToday} losses today. You asked to stop after ${limit.maxDailyLosses}.`,
          memory: { blobId: limit.blobId, explorerUrl: limit.explorerUrl },
        })
      }

      return { pickId: pick.id, trust, advice }
    })
}
