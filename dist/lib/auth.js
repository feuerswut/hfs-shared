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

// gate(ctx, api, { allowedUsers, publicAccess }): null if allowed, else sends
// a deny response and returns { denied: true, reason }.
function gate(ctx, api, opts) {
    opts = opts || {}
    const { getCurrentUsername } = api.require('./auth')
    const username = getCurrentUsername(ctx)

    if (!username) {
        if (opts.publicAccess) return null
        standardResponse.text(ctx, 401, 'Authentication required')
        return { denied: true, reason: 'unauthenticated' }
    }

    const rows = Array.isArray(opts.allowedUsers) ? opts.allowedUsers : []
    const allowed = rows
        .map(r => (typeof r === 'string' ? r : (r && r.enabled !== false ? r.username : null)))
        .filter(Boolean)

    if (allowed.length && !allowed.includes(username)) {
        standardResponse.text(ctx, 403, 'Access denied')
        return { denied: true, reason: 'not-allowed', username }
    }

    return null
}

module.exports = { gate, allowedUsersField }
