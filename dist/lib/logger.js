// Batched logging: aggregates lines instead of one api.log() call per event.
'use strict'

const DEFAULT_BATCH_WINDOW_MS = 60_000
const DEFAULT_MAX_DELAY_MS = 15 * 60_000

// Matches the variable part of an otherwise-repeated log line: IPv4/IPv6
// addresses and bare numbers. Used to cluster e.g. "blocked at socket: 1.2.3.4"
// and "blocked at socket: 5.6.7.8" as the same event instead of two lines.
const TOKEN_RE = /\d{1,3}(?:\.\d{1,3}){3}|(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}|\d+/g
const PLACEHOLDER = '\x00'

function templatize(line) {
    const tokens = []
    const template = line.replace(TOKEN_RE, m => { tokens.push(m); return PLACEHOLDER })
    return { template, tokens }
}

// Collapses a batch of pending lines into one line per distinct "shape":
// exact repeats merge silently, near-repeats that only differ by an IP/number
// list their distinct values (up to 5), and larger clusters collapse to a
// single "N events" line instead of dumping every occurrence.
function summarize(lines) {
    const groups = new Map() // template -> { tokenSets: string[][], lines: string[] }
    for (const line of lines) {
        const { template, tokens } = templatize(line)
        let g = groups.get(template)
        if (!g) groups.set(template, g = { tokenSets: [], lines: [] })
        g.tokenSets.push(tokens)
        g.lines.push(line)
    }

    const out = []
    for (const g of groups.values()) {
        if (g.lines.length === 1 || !g.tokenSets[0].length) {
            out.push(g.lines[0])
            continue
        }
        const template = templatize(g.lines[0]).template
        const numSlots = g.tokenSets[0].length
        const slotValues = Array.from({ length: numSlots }, () => [])
        for (const tokenSet of g.tokenSets)
            for (let i = 0; i < numSlots; i++)
                if (!slotValues[i].includes(tokenSet[i])) slotValues[i].push(tokenSet[i])

        let slot = 0
        out.push(template.replace(new RegExp(PLACEHOLDER, 'g'), () => {
            const values = slotValues[slot++]
            return values.length <= 5 ? values.join(', ') : `${g.lines.length} events`
        }))
    }
    return out
}

// createLogger(api, { tag, batchWindowMs, maxDelayMs }). Each log() call resets
// a trailing-debounce flush timer, capped so a steady trickle of events can't
// postpone the flush past maxDelayMs since the first unflushed line.
function createLogger(api, opts) {
    opts = opts || {}
    // HFS's own api.log() already prefixes every line with `Plugin "id":`,
    // so this tag (if given) is left unbracketed rather than double-wrapped.
    const prefix = opts.tag || ''
    const batchWindowMs = opts.batchWindowMs || DEFAULT_BATCH_WINDOW_MS
    const maxDelayMs = opts.maxDelayMs || DEFAULT_MAX_DELAY_MS

    let pending = []
    let debounceTimer = null
    let firstPendingAt = null

    function flush() {
        if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
        firstPendingAt = null
        if (!pending.length) return
        const lines = pending
        pending = []
        for (const line of summarize(lines)) api.log(prefix, line)
    }

    function log(message) {
        pending.push(message)
        const now = Date.now()
        if (firstPendingAt === null) firstPendingAt = now

        if (debounceTimer) clearTimeout(debounceTimer)
        const sinceFirst = now - firstPendingAt
        const wait = Math.min(batchWindowMs, Math.max(0, maxDelayMs - sinceFirst))
        debounceTimer = setTimeout(flush, wait)
        if (debounceTimer.unref) debounceTimer.unref()
    }

    // Bypasses batching, for verbose-logging mode.
    function logNow(message) {
        api.log(prefix, message)
    }

    function unload() {
        flush()
    }

    return { log, logNow, flush, unload }
}

module.exports = { createLogger }
