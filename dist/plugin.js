// hfs-shared - shared library plugin for feuerswut's HFS plugins.
//
// Exposed via HFS's customApi mechanism (the same one hfs-tailwind uses to
// share its browser.js with other plugins):
//
//   const shared = api.customApiCall('hfsShared')[0]
//   shared.requireVersion('^1.0.0')
//   const { auth, createLogger, ipParse, createHttpAuthClient, adminUi, cfg, response } = shared
//
// Compatibility promise: minor/patch releases never break this surface, only
// a major version bump can. Call requireVersion() once at init() so an
// incompatible pairing fails loudly instead of subtly.

const version = require('./lib/version')
const auth = require('./lib/auth')
const { createLogger } = require('./lib/logger')
const ipParse = require('./lib/ip-parse')
const { createHttpAuthClient } = require('./lib/http-auth')
const adminUi = require('./lib/admin-ui')
const cfg = require('./lib/config-accessor')
const response = require('./lib/standard-response')
const { canonicalPath, servePublic } = require('./lib/serve-public')

exports.description = "Shared library for HFS plugins: auth gating, batched logging and more."
exports.version = 1.2
exports.apiRequired = 13
exports.author = "feuerswut"
exports.repo = "feuerswut/hfs-shared"
exports.changelog = [
    { version: 1.2, message: "servePublic; auth.gate gains redirectUrl." },
]

exports.customApi = {
    hfsShared: () => ({
        version: version.VERSION,
        requireVersion: version.requireVersion,
        auth,
        createLogger,
        ipParse,
        createHttpAuthClient,
        adminUi,
        cfg,
        response,
        canonicalPath,
        servePublic,
    }),
}

exports.init = async api => {
    api.log(`[hfs-shared] loaded, module version ${version.VERSION}`)
    return {}
}
