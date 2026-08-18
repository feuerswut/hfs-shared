// Reads a config value with a fallback default and optional min/max clamping.
'use strict'

function num(api, key, defaultValue, opts) {
    opts = opts || {}
    let value = Number(api.getConfig(key)) || defaultValue
    if (opts.min !== undefined) value = Math.max(opts.min, value)
    if (opts.max !== undefined) value = Math.min(opts.max, value)
    return value
}

function bool(api, key, defaultValue) {
    const raw = api.getConfig(key)
    return raw === undefined || raw === null ? !!defaultValue : !!raw
}

function str(api, key, defaultValue) {
    const raw = api.getConfig(key)
    return typeof raw === 'string' && raw.length ? raw : defaultValue
}

module.exports = { num, bool, str }
