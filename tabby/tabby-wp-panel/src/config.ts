import { ConfigProvider } from 'tabby-core'

/** WP Panel Assistant settings stored in Tabby's config file. */
export class WpPanelConfigProvider extends ConfigProvider {
    defaults = {
        wpPanel: {
            checkUpdates: true, // user decision 2026-11-10: on by default, can be turned off on the home page
            skippedUpdate: '', // "do not remind me about this version"
            terminalLookApplied: false, // terminalLook.ts: readable light terminal, applied once
        },
    }

    platformDefaults = { }
}
