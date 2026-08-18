// Bearer-auth HTTP client with hash-based change detection.
'use strict'

const http = require('http')
const https = require('https')
const crypto = require('crypto')

function httpRequest(urlString, options, body) {
    return new Promise((resolve, reject) => {
        let url
        try { url = new URL(urlString) }
        catch (e) { reject(e); return }
        const mod = url.protocol === 'https:' ? https : http
        const req = mod.request(url, options, res => {
            const chunks = []
            res.on('data', c => chunks.push(c))
            res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
        })
        req.on('error', reject)
        req.end(body)
    })
}

function joinUrl(base, suffix) {
    return base.replace(/\/+$/, '') + suffix
}

// createHttpAuthClient({ baseUrl, apiKey, authScheme, userAgent, headers }) -> { post, getWithChangeDetection }
// authScheme defaults to 'Bearer' (unchanged from before); userAgent/headers are
// additive options for callers that need extra/different static headers.
function createHttpAuthClient(opts) {
    opts = opts || {}
    const lastHash = new Map() // path -> sha256 hex of the last body seen

    function authHeaders() {
        return Object.assign(
            opts.userAgent ? { 'User-Agent': opts.userAgent } : {},
            opts.apiKey ? { Authorization: (opts.authScheme || 'Bearer') + ' ' + opts.apiKey } : {},
            opts.headers || {},
        )
    }

    async function post(path, bodyObj) {
        const payload = JSON.stringify(bodyObj)
        return httpRequest(joinUrl(opts.baseUrl, path), {
            method: 'POST',
            headers: Object.assign({
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            }, authHeaders()),
        }, payload)
    }

    // Returns { changed: false } when the response hash matches the last
    // successful fetch of this path, else { changed: true, body, statusCode }.
    async function getWithChangeDetection(path) {
        const res = await httpRequest(joinUrl(opts.baseUrl, path), { method: 'GET', headers: authHeaders() })
        if (res.statusCode < 200 || res.statusCode >= 300)
            return { changed: false, statusCode: res.statusCode }
        const hash = crypto.createHash('sha256').update(res.body).digest('hex')
        if (hash === lastHash.get(path))
            return { changed: false, statusCode: res.statusCode }
        lastHash.set(path, hash)
        return { changed: true, statusCode: res.statusCode, body: res.body }
    }

    return { post, getWithChangeDetection }
}

module.exports = { createHttpAuthClient, httpRequest, joinUrl }
