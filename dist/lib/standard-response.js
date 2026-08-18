// Common response shapes: redirect, defer to HFS's own handling, plain text
// with a status code, or a custom responder.
'use strict'

function redirect(ctx, url, status) {
    ctx.status = status || 302
    ctx.set('Location', url)
    ctx.body = ''
    ctx.stop()
}

// No-op: defers to HFS's own frontend/static handling.
function passthrough(ctx) {
    return undefined
}

// opts.translate: optional (message) => translatedMessage function.
function text(ctx, status, message, opts) {
    opts = opts || {}
    const body = typeof opts.translate === 'function' ? opts.translate(message) : message
    ctx.status = status
    ctx.type = 'text/plain'
    ctx.body = body
    ctx.stop()
}

function custom(ctx, fn) {
    return fn(ctx)
}

module.exports = { redirect, passthrough, text, custom }
