// Pure-logic smoke tests -- no HFS runtime needed. The customApi round trip
// itself is verified against a live HFS dev instance, not here.
'use strict'

const assert = require('assert')
const ipParse = require('../dist/lib/ip-parse')
const cfg = require('../dist/lib/config-accessor')
const { createLogger } = require('../dist/lib/logger')
const version = require('../dist/lib/version')
const auth = require('../dist/lib/auth')
const response = require('../dist/lib/standard-response')
const adminUi = require('../dist/lib/admin-ui')

function mockCtx() {
    const headers = {}
    return {
        status: 0, type: '', body: null, stopped: false,
        set: (k, v) => { headers[k] = v },
        stop() { this.stopped = true },
        headers,
    }
}

// auth.gate
{
    const apiFor = username => ({ require: () => ({ getCurrentUsername: () => username }) })

    let ctx = mockCtx()
    const deniedAnon = auth.gate(ctx, apiFor(null), {})
    assert.strictEqual(deniedAnon.reason, 'unauthenticated')
    assert.strictEqual(ctx.status, 401)

    ctx = mockCtx()
    assert.strictEqual(auth.gate(ctx, apiFor(null), { publicAccess: true }), null)

    ctx = mockCtx()
    assert.strictEqual(auth.gate(ctx, apiFor('alice'), { allowedUsers: [] }), null)

    ctx = mockCtx()
    const deniedRole = auth.gate(ctx, apiFor('mallory'), { allowedUsers: [{ username: 'alice', enabled: true }] })
    assert.strictEqual(deniedRole.reason, 'not-allowed')
    assert.strictEqual(ctx.status, 403)
}

// standard-response
{
    const ctx = mockCtx()
    response.redirect(ctx, '/new-path')
    assert.strictEqual(ctx.status, 302)
    assert.strictEqual(ctx.headers.Location, '/new-path')
}

// admin-ui
{
    const merged = adminUi.buildSections({ a: 1 }, { header_t: adminUi.sectionHeader('T', 'D') }, { b: 2 })
    assert.deepStrictEqual(Object.keys(merged), ['a', 'header_t', 'b'])
    assert.strictEqual(merged.header_t.type, 'show_html')
}

// ip-parse
assert.strictEqual(ipParse.ip2long('192.168.1.1'), 0xC0A80101)
assert.strictEqual(ipParse.long2ip(0xC0A80101), '192.168.1.1')
assert.strictEqual(ipParse.isLocalIP(ipParse.ip2long('10.0.0.5')), true)
assert.strictEqual(ipParse.isLocalIP(ipParse.ip2long('8.8.8.8')), false)
assert.deepStrictEqual(ipParse.parseIPRange('192.168.1.0/24'), { start: 0xC0A80100, end: 0xC0A801FF, isIPv6: false })
assert.strictEqual(ipParse.ipv6ToBigInt('::1'), 1n)
assert.strictEqual(ipParse.isLocalIPv6(ipParse.ipv6ToBigInt('fe80::1')), true)

// config-accessor
{
    const api = { getConfig: k => ({ n: '42', bad: 'nope' }[k]) }
    assert.strictEqual(cfg.num(api, 'n', 10), 42)
    assert.strictEqual(cfg.num(api, 'bad', 10), 10)
    assert.strictEqual(cfg.num(api, 'n', 10, { max: 20 }), 20)
    assert.strictEqual(cfg.bool(api, 'missing', true), true)
}

// version
assert.strictEqual(version.requireVersion('^1.0.0'), true)
assert.throws(() => version.requireVersion('^2.0.0'))

// logger: batches multiple log() calls into one flush
async function testLogger() {
    const lines = []
    const api = { log: (...args) => lines.push(args.join(' ')) }
    const logger = createLogger(api, { tag: 'test', batchWindowMs: 10, maxDelayMs: 1000 })
    logger.log('a')
    logger.log('b')
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.strictEqual(lines.length, 3) // header line + one line per event
}

testLogger().then(() => console.log('hfs-shared smoke tests passed'))
