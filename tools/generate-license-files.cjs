#!/usr/bin/env node
// WP Panel Assistant: license files shipped next to the app (stage 6, docs/07: the installer must include LICENSE).
// Run after `yarn run build` and `node scripts/prepackage-plugins.mjs`, before electron-builder.
// Writes tabby/build/licenses/{LICENSE.txt, LICENSE.tabby.txt, THIRD-PARTY-NOTICES.txt}; electron-builder copies them
// into the install directory (electron-builder.yml extraFiles). No dependencies: reads package.json / LICENSE files.
'use strict'
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const tabby = path.join(root, 'tabby')
const out = path.join(tabby, 'build', 'licenses')
fs.mkdirSync(out, { recursive: true })

// 1. Project license (GPL-3.0) and the upstream Tabby MIT notice (ADR-0006).
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(out, 'LICENSE.txt'))
fs.copyFileSync(path.join(tabby, 'LICENSE'), path.join(out, 'LICENSE.tabby.txt'))

// 2. Third-party packages: the packaged app's node_modules, plus code bundled into each built-in plugin.
const packages = new Map() // key name@version -> info
const unresolved = new Set()
const problems = [] // review WPPA-007: anything that would make the notices incomplete fails the build

// Packages without a license field in package.json (checked by hand 2026-11-10). If the package has no license file,
// the matching README/source excerpt is copied into the notices. Any other package without license metadata fails.
const DOCUMENTED = {
    'sprintf@0.1.3': { license: 'BSD-3-Clause', file: 'lib/sprintf.js', from: /Copyright \(c\) Alexandru/ },
    'binstring@0.2.1': { license: 'MIT', file: 'README.md', from: /^# License/m },
    'cycle@1.0.3': { license: 'Public Domain', file: 'cycle.js', from: /Public Domain/ },
    'colors@0.6.2': { license: 'MIT', file: 'MIT-LICENSE.txt', from: /Copyright/ },
    'cliff@0.1.10': { license: 'MIT', file: 'LICENSE', from: /Copyright/ },
}

// Packages compiled into an xterm addon's own published bundle (source map paths like "ImageAddon/node_modules/sixel/...")
// and not installed separately. License checked on the npm registry 2026-11-10.
const MIT_TEXT = `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`
const PREBUNDLED = {
    sixel: { license: 'MIT', url: 'https://github.com/jerch/node-sixel', text: `Copyright (c) Joerg Breitbart\n\n${MIT_TEXT}` },
    inwasm: { license: 'MIT', url: 'https://github.com/jerch/inwasm', text: `Copyright (c) Joerg Breitbart\n\n${MIT_TEXT}` },
    'xterm-wasm-parts': { license: 'MIT', url: 'https://github.com/jerch/xterm-wasm-parts', text: `Copyright (c) Joerg Breitbart\n\n${MIT_TEXT}` },
}

function excerpt (dir, doc) {
    try {
        const content = fs.readFileSync(path.join(dir, doc.file), 'utf8')
        const m = doc.from.exec(content)
        return m ? content.slice(m.index).split('\n').slice(0, 40).join('\n').trim() : null
    } catch {
        return null
    }
}

function readPackage (dir) {
    if (!fs.existsSync(path.join(dir, 'package.json'))) {
        return null
    }
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
        if (!pkg.name) {
            return null
        }
        let license = pkg.license ?? pkg.licenses ?? 'UNKNOWN'
        if (Array.isArray(license)) {
            license = license.map(x => x.type ?? x).join(' OR ')
        } else if (typeof license === 'object') {
            license = license.type ?? 'UNKNOWN'
        }
        const licenseFile = fs.readdirSync(dir).find(f => /licen[cs]e|^copying|^notice/i.test(f) && fs.statSync(path.join(dir, f)).isFile())
        let text = licenseFile ? fs.readFileSync(path.join(dir, licenseFile), 'utf8').trim() : null
        const documented = DOCUMENTED[`${pkg.name}@${pkg.version}`]
        if (documented && license === 'UNKNOWN') {
            license = documented.license
            text ??= excerpt(dir, documented)
            if (!text) {
                problems.push(`${pkg.name}@${pkg.version}: documented license text not found in ${documented.file}`)
            }
        }
        const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
        if (license === 'UNKNOWN' && !text) {
            problems.push(`${pkg.name}@${pkg.version ?? ''}: no license field and no license file (${dir})`)
        }
        return { name: pkg.name, version: pkg.version ?? '', license, text, url: pkg.homepage ?? repo ?? '' }
    } catch (error) {
        problems.push(`cannot read ${path.join(dir, 'package.json')}: ${error.message}`)
        return null
    }
}

function add (dir) {
    const info = readPackage(dir)
    if (info) {
        packages.set(`${info.name}@${info.version}`, info)
    }
}

function walkNodeModules (nm) {
    if (!fs.existsSync(nm)) {
        return
    }
    for (const entry of fs.readdirSync(nm)) {
        if (entry.startsWith('.')) {
            continue
        }
        const p = path.join(nm, entry)
        if (entry.startsWith('@')) {
            for (const sub of fs.readdirSync(p)) {
                add(path.join(p, sub))
                walkNodeModules(path.join(p, sub, 'node_modules'))
            }
        } else {
            add(p)
            walkNodeModules(path.join(p, 'node_modules'))
        }
    }
}

walkNodeModules(path.join(tabby, 'app', 'node_modules'))

const builtin = path.join(tabby, 'builtin-plugins')
for (const plugin of fs.existsSync(builtin) ? fs.readdirSync(builtin) : []) {
    const pluginDir = path.join(builtin, plugin)
    walkNodeModules(path.join(pluginDir, 'node_modules'))
    const distDir = path.join(pluginDir, 'dist')
    if (!fs.existsSync(distDir)) {
        continue
    }
    for (const map of fs.readdirSync(distDir).filter(f => f.endsWith('.map'))) {
        let sources
        try {
            sources = JSON.parse(fs.readFileSync(path.join(distDir, map), 'utf8')).sources
        } catch (error) {
            problems.push(`cannot read source map ${path.join(distDir, map)}: ${error.message}`)
            continue
        }
        if (!Array.isArray(sources)) {
            problems.push(`source map without sources: ${path.join(distDir, map)}`)
            continue
        }
        for (const s of sources) {
            // e.g. "webpack-tabby-ssh:///../app/node_modules/mz/fs.js": relative to the plugin's source folder tabby/<plugin>.
            // The greedy match takes the innermost node_modules package (nested dependencies).
            const rel = s.replace(/^webpack[^:]*:\/\/\/?/, '')
            const m = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(rel)
            if (!m) {
                continue // the plugin's own code or webpack runtime
            }
            const name = /node_modules\/((?:@[^/]+\/)?[^/]+)$/.exec(m[1])[1]
            const candidates = [
                path.resolve(tabby, plugin, m[1]),
                // packages compiled into a published addon bundle: the same package installed next to it
                path.join(tabby, plugin, 'node_modules', name),
                path.join(tabby, 'node_modules', name),
                path.join(tabby, 'app', 'node_modules', name),
            ]
            const found = candidates.find(c => fs.existsSync(path.join(c, 'package.json')))
            if (found) {
                add(found)
            } else if (PREBUNDLED[name]) {
                packages.set(`${name}@bundled`, { name, version: '(bundled in an xterm addon)', ...PREBUNDLED[name] })
            } else {
                unresolved.add(`${m[1]} (${map} in ${plugin})`)
            }
        }
    }
}
// Review WPPA-007 follow-up: every package bundled into a plugin must be located, so its license is listed.
for (const u of unresolved) {
    problems.push(`bundled package not found on disk: ${u}`)
}

const sorted = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name))
const lines = [
    'WP Panel Assistant - third-party software notices',
    '',
    'WP Panel Assistant is licensed under the GNU General Public License v3.0 (see LICENSE.txt).',
    'It is based on Tabby (https://github.com/Eugeny/tabby), MIT License (see LICENSE.tabby.txt).',
    'Electron and Chromium notices: LICENSE.electron.txt and LICENSES.chromium.html.',
    '',
    `This file lists ${sorted.length} third-party packages included in this build, with their license texts.`,
    '',
]
for (const p of sorted) {
    lines.push('-'.repeat(78))
    lines.push(`${p.name} ${p.version}`)
    lines.push(`License: ${p.license}`)
    if (p.url) {
        lines.push(`Source: ${p.url}`)
    }
    lines.push('')
    lines.push(p.text ?? `(No license file in the package; licensed under ${p.license}.)`)
    lines.push('')
}
if (problems.length) {
    console.error('License check failed; fix or document these packages before packaging:')
    for (const p of problems) {
        console.error('  ' + p)
    }
    process.exit(1)
}
fs.writeFileSync(path.join(out, 'THIRD-PARTY-NOTICES.txt'), lines.join('\n'))
console.log(`License files written to ${out} (${sorted.length} packages)`)
