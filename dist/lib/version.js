// Semver-style compatibility check for customApi consumers.
'use strict'

const VERSION = '1.3.0'

function parseMajor(range) {
    if (typeof range === 'number') return range
    const m = /^\^?(\d+)/.exec(String(range))
    return m ? +m[1] : NaN
}

// requireVersion('^1.0.0') or requireVersion(1); throws on major mismatch.
function requireVersion(range) {
    const wantMajor = parseMajor(range)
    const haveMajor = parseMajor(VERSION)
    if (!Number.isFinite(wantMajor) || wantMajor !== haveMajor)
        throw new Error(`hfs-shared version mismatch: requires major version ${range}, but ${VERSION} is installed`)
    return true
}

module.exports = { VERSION, requireVersion }
