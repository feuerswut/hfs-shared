// Batched logging: aggregates lines instead of one api.log() call per event.
'use strict'

const DEFAULT_BATCH_WINDOW_MS = 60_000
const DEFAULT_MAX_DELAY_MS = 15 * 60_000

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
        if (lines.length === 1) {
            api.log(prefix, lines[0])
        } else {
            api.log(prefix, `${lines.length} events:`)
            for (const line of lines) api.log(prefix, ' ', line)
        }
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
