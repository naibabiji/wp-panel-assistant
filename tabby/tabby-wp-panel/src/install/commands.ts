// Command builders for the install wizard (stage 3). Based on tools/prototype-reference/commands.ts.
// Only fixed, reviewed command text is produced here; user input (host/port/user) never enters a command.

export type Region = 'overseas' | 'cn'

export const SCREEN_SESSION = 'wpp-install'

/** Commands come from WP Panel README (docs/integrations/wp-panel.md). */
const INSTALL_URLS: Record<Region, string> = {
    overseas: 'https://raw.githubusercontent.com/naibabiji/wp-panel/main/install.sh',
    cn: 'https://gh.wp-panel.org/https://raw.githubusercontent.com/naibabiji/wp-panel/main/install-cn.sh',
}

/**
 * Development only: WPPA_FAKE_INSTALL=1 runs the test container's fake installer (tools/test-server). Never shown in the UI.
 * Honoured only in test builds (version 0.1.0-local.* / 0.1.0-dev.*) or Tabby dev mode; official release builds ignore it.
 */
export function fakeInstallAllowed (appVersion: string): boolean {
    const testBuild = /-(local|dev)\./.test(appVersion) || process.env.TABBY_DEV === '1'
    return testBuild && process.env.WPPA_FAKE_INSTALL === '1'
}

// Download with a bounded wait (wget otherwise retries silently for minutes with -q).
const WGET = 'wget -qO- --tries=3 --timeout=30'
// Shown when the check or the install did not complete. No ASCII quotes, semicolons or parentheses:
// the text is embedded in bash -c "..." and, for non-root users, in sudo bash -c '...'.
const NOT_COMPLETED = 'echo WP Panel 安装没有完成：请查看上方输出。如果上方没有任何输出，说明安装脚本下载失败，请检查服务器网络后点击左侧的重新安装。 / WP Panel was not installed: see the output above. If there is none, the installer could not be downloaded - check the server network and click Install again.'

// Screen settings: -U forces UTF-8 (minimal VPS images often have no locale, which garbles Chinese output and
// drops the credential lines); ti@:te@ keeps scrollback usable; large history. No screen log file (docs/06).
const SCREENRC = 'printf "termcapinfo xterm* ti@:te@\\ndefscrollback 10000\\n" > /tmp/wpp-screenrc'

/**
 * Check, then install only if the check exits 0 (exit codes per WP Panel --check contract).
 * - Check stage: only bash's exit code counts. --check exits as soon as the checks are done without reading the rest
 *   of the script, so wget then fails writing to the closed pipe (exit 3); with pipefail that turned every passing
 *   check into a failure (found by the user on a real server, 2026-11-10).
 * - Install stage: pipefail, so a failed download fails instead of bash exiting 0 on empty input (review WPPA-002).
 *   If the check stage's download failed, bash got nothing and exits 0, but the installer itself runs the same
 *   preflight checks before changing the system, and a second failed download shows the message.
 */
export function checkAndInstall (region: Region, fake: boolean): string {
    if (fake) {
        // No quotes: this text is embedded in bash -c "..." and sudo bash -c '...'.
        return `echo FAKE check result: PASS && (set -o pipefail; bash /opt/fake-install.sh) || ${NOT_COMPLETED}`
    }
    const url = INSTALL_URLS[region]
    return `${WGET} ${url} | bash -s -- --check && (set -o pipefail; ${WGET} ${url} | bash) || ${NOT_COMPLETED}`
}

function asRoot (cmd: string, isRoot: boolean): string {
    if (isRoot) {
        return cmd
    }
    if (cmd.includes('\'')) {
        throw new Error('internal: command contains a single quote')
    }
    return `sudo bash -c '${cmd}'`
}

/**
 * Full start command. If an install session already exists on the server (e.g. started earlier), reattach to it
 * instead of running apt-get again (which would fight the running installer for the apt lock).
 * "exec bash" keeps the session, and the credentials on screen, after the installer exits.
 */
export function buildStartCommand (region: Region, isRoot: boolean, fake: boolean): string {
    const inner = `${checkAndInstall(region, fake)}; exec bash`
    const start = [
        'apt-get update',
        'apt-get install -y wget ca-certificates screen',
        SCREENRC,
        `screen -U -c /tmp/wpp-screenrc -S ${SCREEN_SESSION} bash -c "${inner}"`,
    ].join(' && ')
    // "screen -wipe" first removes dead sessions (e.g. after a server reboot) so they are not mistaken for a running install.
    const cmd = `screen -wipe >/dev/null 2>&1; if screen -ls 2>/dev/null | grep -q "[.]${SCREEN_SESSION}[[:space:]]"; then screen -U -d -r ${SCREEN_SESSION}; else ${start}; fi`
    return asRoot(cmd, isRoot)
}

/** Reattach to the install session; -d detaches a stale attachment left by a dropped connection. */
export function buildResumeCommand (isRoot: boolean): string {
    const cmd = `screen -wipe >/dev/null 2>&1; screen -U -d -r ${SCREEN_SESSION}`
    return asRoot(cmd, isRoot)
}

const HOST_RE = /^[A-Za-z0-9.\-:[\]]+$/
const USER_RE = /^[a-z_][a-z0-9_.-]*$/i

export type FieldError = 'errHost' | 'errPort' | 'errUser'

export function validateServer (host: string, port: number, user: string): Partial<Record<'host'|'port'|'user', FieldError>> {
    const errors: Partial<Record<'host'|'port'|'user', FieldError>> = {}
    if (!host || !HOST_RE.test(host)) {
        errors.host = 'errHost'
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        errors.port = 'errPort'
    }
    if (!user || !USER_RE.test(user)) {
        errors.user = 'errUser'
    }
    return errors
}
