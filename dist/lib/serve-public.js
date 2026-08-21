// HFS already auto-serves a plugin's dist/public/ folder at its fixed
// /~/plugins/<id>/ path -- servePublic() only adds what that automatic
// serving can't do on its own: an auth gate, an optional legacy-path
// redirect, normalizing the dashboard to one trailing-slash URL instead of
// also answering at the bare path or a literal /index.html, and an optional
// custom-frontend override folder.
'use strict'

const path = require('path')
const fs = require('fs')
const auth = require('./auth')
const response = require('./standard-response')

function canonicalPath(api) {
    return `/~/plugins/${api.id}/`
}

// opts:
//   subPath           -- where the dashboard lives under the canonical root,
//                         e.g. '' (default, the root itself) or 'admin'
//   allowedUsers, publicAccess, redirectUrl, hideFromUnauthorized -- passed
//                         straight to auth.gate()
//   pathAlias         -- an old URL that should redirect here (or falsy for none)
//   useCustomFrontend -- when true, storage/custom-frontend/index.html wins
//                         over the bundled one, if present
//   distDir           -- the plugin's own dist directory (pass __dirname)
//   indexFile         -- the bundled entry file's name under distDir/public/
//                         and storageDir/custom-frontend/ (default 'index.html')
//
// Returns true when it fully handled ctx (redirected, served, or denied) --
// the caller should return immediately. Returns false when the request is
// outside the canonical namespace, or inside it but not the dashboard entry
// point itself (e.g. one of the plugin's own API routes) -- the caller
// keeps going with its own routing, or lets HFS's automatic serving answer.
function servePublic(ctx, api, opts) {
    opts = opts || {}
    const canonical = canonicalPath(api).replace(/\/+$/, '')
    const subPath = String(opts.subPath || '').replace(/^\/+|\/+$/g, '')
    const dashboardRoot = subPath ? `${canonical}/${subPath}` : canonical
    const indexFile = opts.indexFile || 'index.html'

    // The alias covers the whole plugin namespace (any API routes included),
    // not just the dashboard's own subPath, so it redirects into the plugin
    // root -- not dashboardRoot, which may be a sub-route of that root.
    if (opts.pathAlias) {
        const alias = String(opts.pathAlias).replace(/\/+$/, '')
        if (alias && alias !== canonical && (ctx.path === alias || ctx.path.startsWith(alias + '/'))) {
            const suffix = ctx.path.slice(alias.length)
            response.redirect(ctx, canonical + suffix + (ctx.querystring ? '?' + ctx.querystring : ''), 307)
            return true
        }
    }

    if (ctx.path !== dashboardRoot && ctx.path !== `${dashboardRoot}/` && ctx.path !== `${dashboardRoot}/${indexFile}`)
        return false

    if (ctx.path !== `${dashboardRoot}/`) {
        response.redirect(ctx, `${dashboardRoot}/${ctx.querystring ? '?' + ctx.querystring : ''}`)
        return true
    }

    const denied = auth.gate(ctx, api, {
        allowedUsers: opts.allowedUsers, publicAccess: opts.publicAccess,
        redirectUrl: opts.redirectUrl, hideFromUnauthorized: opts.hideFromUnauthorized,
    })
    // A silent denial means "pretend this plugin isn't here" -- nothing was
    // written to ctx, so the caller must fall through (false), not stop.
    if (denied) return !denied.silent

    if (opts.useCustomFrontend) {
        const customFile = path.join(api.storageDir, 'custom-frontend', indexFile)
        try {
            if (fs.statSync(customFile).isFile()) {
                ctx.type = 'text/html; charset=utf-8'
                ctx.set('Cache-Control', 'no-cache')
                ctx.body = fs.readFileSync(customFile, 'utf8')
                ctx.stop()
                return true
            }
        } catch {} // fall through to the bundled file
    }

    try {
        ctx.type = 'text/html; charset=utf-8'
        ctx.set('Cache-Control', 'no-cache')
        ctx.body = fs.readFileSync(path.join(opts.distDir, 'public', indexFile), 'utf8')
    } catch {
        ctx.status = 404
    }
    ctx.stop()
    return true
}

module.exports = { canonicalPath, servePublic }
