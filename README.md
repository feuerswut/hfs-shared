# hfs-shared

Shared library plugin for HFS (https://github.com/rejetto/hfs) plugins. 
Exposes auth gating, batched logging, IP/CIDR parsing, an HTTP client, 
admin-UI helpers, config access, and standard responses, so this logic 
lives in one place instead of being reimplemented (and re-drifting)
per plugin.

## Usage

Install `hfs-shared` alongside any plugin that needs it, then in that
plugin's `init(api)`:

```js
const shared = api.customApiCall('hfsShared')[0]
shared.requireVersion('^1.0.0') // throws on a major-version mismatch

const { auth, createLogger, ipParse, createHttpAuthClient, adminUi, cfg, response } = shared
```

This is the same `customApi`/`customApiCall` mechanism `hfs-tailwind` uses to
share its `browser.js` with other plugins -- no npm package, no
filesystem-relative `require()`, no HFS core changes needed.

## Modules

- **auth** -- `gate(ctx, api, { allowedUsers, publicAccess })` gates a
  request to a configured allowlist of HFS accounts. `allowedUsersField()`
  builds the config schema for that allowlist using HFS's native username
  picker.
- **createLogger** -- `createLogger(api, { tag, batchWindowMs, maxDelayMs })`
  batches log lines instead of one `api.log()` call per event, with a
  trailing-debounce flush capped at `maxDelayMs`.
- **ipParse** -- IPv4/IPv6 parsing, CIDR/range matching, and a packed
  range-list structure for large blocklists.
- **createHttpAuthClient** -- `createHttpAuthClient({ baseUrl, apiKey })`
  gives `.post(path, body)` and `.getWithChangeDetection(path)`, a
  bearer-auth HTTP client with sha256-based change detection for polling
  endpoints that rarely change.
- **adminUi** -- `sectionHeader(title, desc)` and `buildSections(...)` for
  building a sectioned admin config UI out of HFS's `show_html` field type.
- **cfg** -- `num`, `bool`, `str`: read a config value with a fallback
  default and optional clamping.
- **response** -- `redirect`, `passthrough`, `text`, `custom`: common ways
  to answer an HFS request.

## Compatibility promise

Minor and patch releases never break this `customApi` surface -- only a
major version bump can. Call `shared.requireVersion(range)` once at your
plugin's `init()` so an incompatible pairing fails loudly instead of subtly.

## Testing

```
npm test
```

Runs the pure-logic smoke tests (no HFS runtime needed). The `customApiCall`
round trip itself is verified against a live HFS dev instance.

## License

AGPL-3.0. See `LICENSE` for the full text and attribution notice.
