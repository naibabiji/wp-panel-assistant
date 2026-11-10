import { Injectable } from '@angular/core'
import { ConfigService, TerminalColorScheme } from 'tabby-core'
import { TerminalColorSchemeProvider } from 'tabby-terminal'

/**
 * Terminal look (user request 2026-11-10): the upstream light terminal (gray text, pale yellow/cyan, GPU-drawn thin
 * glyphs) was hard to read. Kept in this plugin so upstream Tabby files stay unchanged.
 * Every color reaches at least 4.5:1 against the white background.
 */
export const WP_PANEL_LIGHT: TerminalColorScheme = {
    name: 'WP Panel Light',
    foreground: '#1f2328',
    background: '#ffffff',
    cursor: '#1f2328',
    colors: [
        '#24292f', '#cf222e', '#116329', '#7d4e00', '#0969da', '#8250df', '#1b7c83', '#6e7781',
        '#57606a', '#a40e26', '#1a7f37', '#633c01', '#0550ae', '#6639ba', '#156b72', '#6e7781',
    ],
}

/** Lists the scheme in Settings → Color scheme. */
@Injectable()
export class WpPanelColorSchemes extends TerminalColorSchemeProvider {
    async getSchemes (): Promise<TerminalColorScheme[]> {
        return [WP_PANEL_LIGHT]
    }
}

/**
 * Applied once per installation. Tabby merges plugin defaults by concatenating arrays, so a default scheme from a
 * plugin would keep upstream colors; set the value instead. Only replaces values the user has not customized.
 */
export async function applyTerminalLookOnce (config: ConfigService): Promise<void> {
    await config.ready$.toPromise()
    const store = config.store
    if (store.wpPanel.terminalLookApplied) {
        return
    }
    if (store.terminal.lightColorScheme?.name === 'Tabby Default Light') {
        store.terminal.lightColorScheme = { ...WP_PANEL_LIGHT, colors: [...WP_PANEL_LIGHT.colors] }
    }
    // Canvas draws text like other Windows programs; the WebGL frontend renders thin, pale glyphs on light backgrounds.
    if (store.terminal.frontend === 'xterm-webgl') {
        store.terminal.frontend = 'xterm'
    }
    store.wpPanel.terminalLookApplied = true
    await config.save()
}
