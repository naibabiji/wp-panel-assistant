import { Injectable } from '@angular/core'
import { promises as fs } from 'fs'
import * as https from 'https'
import { BehaviorSubject } from 'rxjs'
import { ConfigService, PlatformService } from 'tabby-core'
import { GITHUB_RELEASES_URL, WEBSITE_URL } from './links'

/**
 * Update notice (design confirmed 2026-11-10, docs/features/update-notice.md):
 * read the public latest.json, and if it names a newer version, show it on the home page with two download links.
 * Nothing is downloaded or installed by the app; no device information is sent.
 */
export interface UpdateInfo {
    version: string
    notes: { zh: string, en: string }
    github: string
    website: string
}

// Same order as the installer: GitHub first, then the mainland China proxy (latest.json is whitelisted there).
const SOURCES = [
    'https://raw.githubusercontent.com/naibabiji/wp-panel-assistant/main/latest.json',
    'https://gh.wp-panel.org/https://raw.githubusercontent.com/naibabiji/wp-panel-assistant/main/latest.json',
]
// A tampered latest.json must not be able to send users to another site.
const ALLOWED_LINK_PREFIXES = {
    github: 'https://github.com/naibabiji/wp-panel-assistant/',
    website: 'https://wp-panel.org/',
}
const TIMEOUT_MS = 10000
const MAX_BYTES = 64 * 1024
const MAX_NOTES = 4000

export type ManualResult = 'available' | 'latest' | 'failed'

export function isTestBuild (appVersion: string): boolean {
    return /-(local|dev)\./.test(appVersion) || process.env.TABBY_DEV === '1'
}

/** Numeric x.y.z comparison; a test build suffix (0.1.0-local.N) counts as its base version. */
export function isNewer (latest: string, current: string): boolean {
    const parse = (v: string) => v.split(/[-+]/)[0].split('.').map(x => parseInt(x, 10) || 0)
    const a = parse(latest)
    const b = parse(current)
    for (let i = 0; i < 3; i++) {
        if ((a[i] ?? 0) !== (b[i] ?? 0)) {
            return (a[i] ?? 0) > (b[i] ?? 0)
        }
    }
    return false
}

export function parseUpdateInfo (text: string): UpdateInfo|null {
    let data: any = null
    try {
        data = JSON.parse(text)
    } catch {
        return null
    }
    const str = (x: unknown, max: number) => typeof x === 'string' && x.length <= max ? x : null
    const version = str(data?.version, 32)
    const zh = str(data?.notes?.zh, MAX_NOTES)
    const en = str(data?.notes?.en, MAX_NOTES)
    const github = str(data?.github, 300)
    const website = str(data?.website, 300)
    if (!version || !/^\d+\.\d+\.\d+$/.test(version) || zh === null || en === null) {
        return null
    }
    return {
        version,
        notes: { zh, en },
        github: github?.startsWith(ALLOWED_LINK_PREFIXES.github) ? github : GITHUB_RELEASES_URL,
        website: website?.startsWith(ALLOWED_LINK_PREFIXES.website) ? website : WEBSITE_URL,
    }
}

function download (url: string): Promise<string|null> {
    return new Promise(resolve => {
        const req = https.get(url, { timeout: TIMEOUT_MS, headers: { 'User-Agent': 'WP-Panel-Assistant' } }, res => {
            if (res.statusCode !== 200) {
                res.resume()
                resolve(null)
                return
            }
            let body = ''
            res.setEncoding('utf8')
            res.on('data', chunk => {
                body += chunk
                if (body.length > MAX_BYTES) {
                    req.destroy()
                    resolve(null)
                }
            })
            res.on('end', () => resolve(body))
            res.on('error', () => resolve(null))
        })
        req.on('timeout', () => req.destroy())
        req.on('error', () => resolve(null))
    })
}

@Injectable({ providedIn: 'root' })
export class UpdateService {
    /** A newer version the user has not dismissed, or null. */
    readonly available$ = new BehaviorSubject<UpdateInfo|null>(null)
    private autoChecked = false

    constructor (private config: ConfigService, private platform: PlatformService) { }

    /** Test builds only: WPPA_UPDATE_FILE names a local latest.json to try the notice (ignored in release builds). */
    private get testFile (): string|null {
        const file = process.env.WPPA_UPDATE_FILE
        return file && isTestBuild(this.platform.getAppVersion()) ? file : null
    }

    private async fetchLatest (): Promise<UpdateInfo|null> {
        const testFile = this.testFile
        if (testFile) {
            return parseUpdateInfo(await fs.readFile(testFile, 'utf8').catch(() => ''))
        }
        for (const url of SOURCES) {
            const text = await download(url)
            const info = text === null ? null : parseUpdateInfo(text)
            if (info) {
                return info
            }
        }
        return null
    }

    /** Once per app start, if enabled; release builds only. Failures are silent. */
    async autoCheck (): Promise<void> {
        if (this.autoChecked) {
            return
        }
        this.autoChecked = true
        await this.config.ready$.toPromise()
        const version = this.platform.getAppVersion()
        if (!this.config.store.wpPanel.checkUpdates || isTestBuild(version) && !this.testFile) {
            return
        }
        const info = await this.fetchLatest()
        if (info && isNewer(info.version, version) && info.version !== this.config.store.wpPanel.skippedUpdate) {
            this.available$.next(info)
        }
    }

    /** "Check for updates" link: always checks, and shows the result even for a version the user skipped. */
    async manualCheck (): Promise<ManualResult> {
        const info = await this.fetchLatest()
        if (!info) {
            return 'failed'
        }
        if (isNewer(info.version, this.platform.getAppVersion())) {
            this.available$.next(info)
            return 'available'
        }
        this.available$.next(null)
        return 'latest'
    }

    skip (version: string): void {
        this.config.store.wpPanel.skippedUpdate = version
        this.config.save()
        this.available$.next(null)
    }

    get autoEnabled (): boolean {
        return this.config.store.wpPanel.checkUpdates
    }

    set autoEnabled (value: boolean) {
        this.config.store.wpPanel.checkUpdates = value
        this.config.save()
    }
}
