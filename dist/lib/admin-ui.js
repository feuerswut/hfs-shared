// Sectioned admin config UI, built from HFS's show_html field type.
'use strict'

// HFS renders show_html entries as static content in place, so a heading
// placed before a group of fields visually splits the config form into
// sections, relying only on object key order.
function sectionHeader(title, desc) {
    return {
        type: 'show_html',
        html: `<hr/><h3 style="margin:.3em 0">${title}</h3>`
            + (desc ? `<div style="opacity:.65;font-size:.85em;margin-bottom:.5em">${desc}</div>` : ''),
    }
}

// Merges any number of config-schema objects/section headers, in order.
function buildSections(...sections) {
    return Object.assign({}, ...sections)
}

module.exports = { sectionHeader, buildSections }
