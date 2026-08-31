'use strict'

const { EventEmitter } = require('events')
if (EventEmitter.defaultMaxListeners < 100) EventEmitter.defaultMaxListeners = 100

function guardPlugin(api, config, opts) {
    const { id, apiMethod, versionRange, label = id, warningKey = `_dep_${id}_warning`, onReady, onLost } = opts
    let ready = null, started = false, poller = null

    function check(reason) {
        const dep = api.customApiCall(apiMethod)[0]
        let why = !dep && (reason || 'not installed or not running')
        if (dep && versionRange && dep.requireVersion)
            try { dep.requireVersion(versionRange) } catch (e) { why = e.message }
        const ok = !why
        if (ok === ready) return
        ready = ok
        if (ok) {
            clearInterval(poller); poller = null
            delete config[warningKey]
            if (!started) { started = true; onReady?.(dep) }
        } else {
            poller ??= setInterval(check, 10_000).unref()
            config[warningKey] = {
                type: 'show_html',
                html: `<div style="padding:.6em 1em;margin-bottom:1em;border-left:4px solid #d33;background:color-mix(in srgb, #d33 12%, transparent)">`
                    + `<b>${label} required:</b> ${why}.<br>`
                    + `<i>This message clears automatically once ${label} has been installed. If not, restart this plugin manually.</i><br>`
                    + `<a href="https://github.com/feuerswut/hfs-shared/blob/main/WHY-THIS-WARNING.md" target="_blank" rel="noopener">More information</a></div>`,
            }
            onLost?.()
        }
        api.events.emit('pluginUpdated', { id: api.id, config, started: new Date().toISOString(), badApi: null })
    }

    check()
    api.events.on(`pluginStarted:${id}`, () => check())
    api.events.on('pluginUpdated', p => p?.id === id && check())
    api.events.on('pluginStopped', p => p?.id === id && check('stopped'))
    api.events.on('pluginUninstalled', pid => pid === id && check('uninstalled'))
}

module.exports = { guardPlugin }
