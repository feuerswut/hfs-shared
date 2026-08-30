// hfs-shared - shared library plugin for HFS plugins.

const version = require('./lib/version')
const auth = require('./lib/auth')
const { createLogger } = require('./lib/logger')
const ipParse = require('./lib/ip-parse')
const { createHttpAuthClient } = require('./lib/http-auth')
const adminUi = require('./lib/admin-ui')
const cfg = require('./lib/config-accessor')
const response = require('./lib/standard-response')
const { canonicalPath, servePublic } = require('./lib/serve-public')
const { guardPlugin } = require('./lib/dependency-guard')

exports.description = "Shared library for HFS plugins: auth gating, batched logging and more."
exports.version = 1.7
exports.apiRequired = 13
exports.author = "feuerswut"
exports.repo = "feuerswut/hfs-shared"

exports.changelog = [
    { version: 1.7, message: "dependencyGuard() now gives the specific reason (missing, stopped, uninstalled, version mismatch) instead of one generic message, and adds a 10s fallback poll alongside its event listeners so a missed event can't leave the warning stuck." },
    { version: 1.4, message: "createLogger's batch flush now clusters near-identical lines (e.g. an IP address being the only difference) into one summarized line instead of dumping every occurrence after a 'N events' header." },
    { version: 1.3, message: "servePublic logs and reports file-read failures instead of a silent 404." },
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
        dependencyGuard: guardPlugin,
    }),
}

exports.init = async api => {
    api.log(`[hfs-shared] loaded, module version ${version.VERSION}`)
    return {}
}
