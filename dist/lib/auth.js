// Gates a request to a configured allowlist of HFS accounts.
'use strict'

const standardResponse = require('./standard-response')

// Config field: array of allowed HFS usernames via the native username picker.
function allowedUsersField(opts) {
    opts = opts || {}
    return {
        type: 'array',
        label: opts.label || 'Allowed Users',
        defaultValue: [],
        helperText: opts.helperText || 'HFS accounts allowed to access this. Empty = any authenticated user.',
        fields: {
            username: { type: 'username', label: 'User or group', required: true, $width: 4 },
            enabled: { type: 'boolean', label: 'Enabled', defaultValue: true, $width: 2 },
        },
    }
}

// gate(ctx, api, { allowedUsers, publicAccess, redirectUrl, hideFromUnauthorized, failClosed }):
// null if allowed, else { denied: true, reason } after sending a deny
// response -- unless hideFromUnauthorized is set and the request is simply
// unauthenticated, in which case nothing is written to ctx at all (the
// result carries `silent: true`) so the caller can fall through as if this
// plugin weren't there, instead of revealing its existence with a 401/403.
// redirectUrl, if set, sends a 302 there instead of a plain 401/403 text body.
function gate(ctx, api, opts) {
    opts = opts || {}
    const { getCurrentUsername } = api.require('./auth')
    const username = getCurrentUsername(ctx)

    function deny(status, message, reason) {
        if (opts.redirectUrl) standardResponse.redirect(ctx, opts.redirectUrl)
        else standardResponse.text(ctx, status, message)
        return { denied: true, reason }
    }

    const rows = Array.isArray(opts.allowedUsers) ? opts.allowedUsers : []
    const allowed = rows
        .map(r => (typeof r === 'string' ? r : (r && r.enabled !== false ? r.username : null)))
        .filter(Boolean)

    // opt-in: an empty/unconfigured allowlist normally means "any authenticated
    // user" (see allowedUsersField's own helper text). A caller gating something
    // sensitive (an admin route, a PII listing) can set failClosed to flip that
    // default to "nobody at all", including anonymous requests, until at least
    // one user is explicitly configured.
    if (opts.failClosed && !allowed.length)
        return deny(403, opts.failClosedMessage || 'Access denied: no allowed users are configured.', 'unconfigured')

    if (!username) {
        if (opts.publicAccess) return null
        if (opts.hideFromUnauthorized) return { denied: true, reason: 'hidden', silent: true }
        return deny(401, 'Authentication required', 'unauthenticated')
    }

    if (allowed.length && !allowed.includes(username)) {
        const denied = deny(403, 'Access denied', 'not-allowed')
        denied.username = username
        return denied
    }

    return null
}

module.exports = { gate, allowedUsersField }
