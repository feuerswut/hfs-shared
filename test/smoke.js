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
const { canonicalPath, servePublic } = require('../dist/lib/serve-public')
const fs = require('fs')
const os = require('os')
const path = require('path')

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

// serve-public
{
    const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-shared-servepublic-'))
    fs.mkdirSync(path.join(distDir, 'public'), { recursive: true })
    fs.writeFileSync(path.join(distDir, 'public', 'index.html'), '<html>bundled</html>')
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-shared-servepublic-storage-'))

    const makeApi = username => ({
        id: 'hfs-example', distDir, storageDir,
        require: () => ({ getCurrentUsername: () => username }),
    })
    const makeCtx = (p, qs) => {
        const headers = {}
        return {
            path: p, querystring: qs || '', status: 200, body: undefined, type: undefined,
            set: (k, v) => { headers[k] = v }, stop() { this.stopped = true }, headers,
        }
    }

    assert.strictEqual(canonicalPath(makeApi('alice')), '/~/plugins/hfs-example/')

    // outside the namespace entirely: not handled
    {
        const ctx = makeCtx('/somewhere/else')
        assert.strictEqual(servePublic(ctx, makeApi('alice'), { distDir }), false)
    }

    // bare path and /index.html both redirect to the trailing-slash root
    for (const p of ['/~/plugins/hfs-example', '/~/plugins/hfs-example/index.html']) {
        const ctx = makeCtx(p, 'x=1')
        assert.strictEqual(servePublic(ctx, makeApi('alice'), { distDir }), true)
        assert.strictEqual(ctx.status, 302)
        assert.strictEqual(ctx.headers.Location, '/~/plugins/hfs-example/?x=1')
    }

    // unauthenticated: denied at the root
    {
        const ctx = makeCtx('/~/plugins/hfs-example/')
        assert.strictEqual(servePublic(ctx, makeApi(null), { distDir }), true)
        assert.strictEqual(ctx.status, 401)
    }

    // authenticated: serves the bundled index.html at the trailing-slash root
    {
        const ctx = makeCtx('/~/plugins/hfs-example/')
        assert.strictEqual(servePublic(ctx, makeApi('alice'), { distDir }), true)
        assert.strictEqual(ctx.body, '<html>bundled</html>')
        assert.strictEqual(ctx.type, 'text/html; charset=utf-8')
    }

    // useCustomFrontend: an override file wins over the bundled one
    {
        fs.mkdirSync(path.join(storageDir, 'custom-frontend'), { recursive: true })
        fs.writeFileSync(path.join(storageDir, 'custom-frontend', 'index.html'), '<html>custom</html>')
        const ctx = makeCtx('/~/plugins/hfs-example/')
        assert.strictEqual(servePublic(ctx, makeApi('alice'), { distDir, useCustomFrontend: true }), true)
        assert.strictEqual(ctx.body, '<html>custom</html>')
    }

    // subPath: the dashboard can live under a sub-route instead of the root
    {
        const ctx = makeCtx('/~/plugins/hfs-example/admin')
        assert.strictEqual(servePublic(ctx, makeApi('alice'), { distDir, subPath: 'admin' }), true)
        assert.strictEqual(ctx.status, 302)
        assert.strictEqual(ctx.headers.Location, '/~/plugins/hfs-example/admin/')
    }

    // pathAlias: an old URL 307-redirects to the canonical one, subpath+query kept
    {
        const ctx = makeCtx('/old/example/api/x', 'y=2')
        assert.strictEqual(servePublic(ctx, makeApi('alice'), { distDir, pathAlias: '/old/example' }), true)
        assert.strictEqual(ctx.status, 307)
        assert.strictEqual(ctx.headers.Location, '/~/plugins/hfs-example/api/x?y=2')
    }

    // a path inside the namespace but not the dashboard entry point (e.g. an
    // API route or an asset) is left for the caller / HFS to handle
    {
        const ctx = makeCtx('/~/plugins/hfs-example/api/data')
        assert.strictEqual(servePublic(ctx, makeApi('alice'), { distDir }), false)
    }

    fs.rmSync(distDir, { recursive: true, force: true })
    fs.rmSync(storageDir, { recursive: true, force: true })
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
