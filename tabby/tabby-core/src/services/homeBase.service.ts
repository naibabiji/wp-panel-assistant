import { Injectable, Inject } from '@angular/core'
import { ConfigService } from './config.service'
import { PlatformService, BOOTSTRAP_DATA, BootstrapData, HostAppService } from '../api'

@Injectable({ providedIn: 'root' })
export class HomeBaseService {
    appVersion: string

    /** @hidden */
    private constructor (
        private config: ConfigService,
        private platform: PlatformService,
        private hostApp: HostAppService,
        @Inject(BOOTSTRAP_DATA) private bootstrapData: BootstrapData,
    ) {
        this.appVersion = platform.getAppVersion()

        // WPPA: Mixpanel analytics removed (ADR-0005); enableAnalytics() is a no-op.
    }

    openGitHub (): void {
        this.platform.openExternal('https://wp-panel.org') // WPPA
    }

    openDiscord (): void {
        this.platform.openExternal('https://wp-panel.org/help/') // WPPA
    }

    openTranslations (): void {
        this.platform.openExternal('https://wp-panel.org') // WPPA
    }

    reportBug (): void {
        let body = `Version: ${this.appVersion}\n`
        body += `Platform: ${this.hostApp.platform} ${process.arch} ${this.platform.getOSRelease()}\n`
        const plugins = this.bootstrapData.installedPlugins.filter(x => !x.isBuiltin).map(x => x.name)
        body += `Plugins: ${plugins.join(', ') || 'none'}\n`
        body += `Frontend: ${this.config.store.terminal?.frontend}\n\n`
        void body
        this.platform.openExternal('https://wp-panel.org/help/') // WPPA
    }

    enableAnalytics (): void {
        // WPPA: analytics removed (ADR-0005); the Mixpanel client and its token are no longer bundled (stage 6).
    }

    getAnalyticsProperties (): Record<string, string> {
        return {
            distinct_id: window.localStorage.analyticsUserID,
            platform: process.platform,
            os: this.platform.getOSRelease(),
            version: this.appVersion,
        }
    }
}
