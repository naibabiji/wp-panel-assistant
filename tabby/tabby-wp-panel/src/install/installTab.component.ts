import { Component, Injector } from '@angular/core'
import { ElectronService } from 'tabby-electron'
import { SSHTabComponent } from 'tabby-ssh'
import { StringKey } from '../i18n'
import { ServerTabBase } from '../shared/serverTabBase'
import { buildResumeCommand, buildStartCommand, checkAndInstall, fakeInstallAllowed } from './commands'

type Step = 'form' | 'confirm' | 'install'
type PortState = 'idle' | 'waiting' | 'ok' | 'fail' | 'preexisting'

/** WP Panel install wizard (stage 3). Left pane of a split tab; the SSH terminal is added on the right. */
@Component({
    selector: 'wp-panel-install-tab',
    templateUrl: './installTab.component.pug',
    styleUrls: ['../shared/serverTab.component.scss'],
    styles: [':host { display: flex; flex: 1 1 auto; width: 100%; height: 100%; overflow-y: auto; }'],
})
export class InstallTabComponent extends ServerTabBase {
    step: Step = 'form'
    command = ''
    portState: PortState = 'idle'
    savedConfirmed = false
    elapsed = '00:00'

    private mode: 'install'|'resume' = 'install'
    private commandSent = false
    private startedAt = 0
    private clock: any = null
    private portTimer: any = null
    /** Bumped whenever polling starts or stops, so a probe that finishes late cannot restart it (review WPPA-009). */
    private portPollGeneration = 0
    private powerBlocker: number|null = null
    private readonly fake = fakeInstallAllowed(this.platform.getAppVersion())

    // A getter (not a readonly field) so the base constructor can read it.
    // eslint-disable-next-line @typescript-eslint/class-literal-property-style
    protected get titleKey (): StringKey { return 'installTab' }
    protected get terminalWanted (): boolean { return this.step === 'install' }

    constructor (injector: Injector, private electron: ElectronService) {
        super(injector)
        this.showRegion = true
        this.destroyed$.subscribe(() => this.stopInstallHelpers())
    }

    // ---- Step 1 → 2 ----

    next (): void {
        if (!this.validate()) {
            return
        }
        this.command = buildStartCommand(this.region, this.isRoot, this.fake)
        this.step = 'confirm'
    }

    backToForm (): void {
        this.removeTerminal()
        this.stopInstallHelpers()
        this.step = 'form'
    }

    async startInstall (): Promise<void> {
        this.mode = 'install'
        await this.enterInstall()
    }

    async resumeInstall (e: Event): Promise<void> {
        e.preventDefault()
        if (!this.validate()) {
            return
        }
        this.mode = 'resume'
        await this.enterInstall()
    }

    private async enterInstall (): Promise<void> {
        this.step = 'install'
        this.savedConfirmed = false
        this.commandSent = false
        this.startedAt = Date.now()
        this.updateClock()
        this.clock ??= setInterval(() => this.updateClock(), 1000)
        this.powerBlocker ??= this.electron.powerSaveBlocker.start('prevent-app-suspension')
        await this.saveServer()
        await this.openTerminal()
    }

    private updateClock (): void {
        const sec = Math.floor((Date.now() - this.startedAt) / 1000)
        const mm = String(Math.floor(sec / 60)).padStart(2, '0')
        const ss = String(sec % 60).padStart(2, '0')
        this.elapsed = `${mm}:${ss}`
    }

    // ---- Terminal ----

    protected onConnected (tab: SSHTabComponent): void {
        const freshInstall = this.mode === 'install' && !this.commandSent
        const command = freshInstall
            ? buildStartCommand(this.region, this.isRoot, this.fake)
            : buildResumeCommand(this.isRoot)
        this.sendWhenQuiet(tab, command, () => {
            this.commandSent = true
            this.mode = 'resume'
            // Start checking 8443 only once the command is on its way (review WPPA-005).
            this.startPortPolling(freshInstall)
        })
    }

    async reinstall (): Promise<void> {
        const command = checkAndInstall(this.region, this.fake)
        if (!await this.confirm({
            title: this.s('reinstallConfirmTitle'),
            lines: [this.s('reinstallConfirmBody')],
            command,
            okText: this.s('reinstall'),
            cancelText: this.s('cancel'),
        })) {
            return
        }
        this.sendNow(command)
    }

    // ---- Port 8443 ----

    /**
     * @param requireTransition fresh install: if 8443 is already open before anything was installed, it belongs to
     *   an existing panel, so report that instead of "panel is up" (review WPPA-005).
     */
    private async startPortPolling (requireTransition: boolean): Promise<void> {
        if (this.portState === 'ok' || this.portTimer) {
            return
        }
        const generation = ++this.portPollGeneration
        this.portState = 'waiting'
        if (requireTransition) {
            const open = await this.probe(8443, 5000)
            // The page may have been closed or sent back to the form while the first probe was running.
            if (generation !== this.portPollGeneration) {
                return
            }
            if (open) {
                this.portState = 'preexisting'
                return
            }
        }
        this.portTimer = setInterval(() => {
            this.probe(8443, 5000).then(ok => {
                if (ok && generation === this.portPollGeneration) {
                    this.portState = 'ok'
                    this.stopPortPolling()
                    this.stopClock()
                }
            })
        }, 10000)
    }

    private stopPortPolling (): void {
        this.portPollGeneration++
        clearInterval(this.portTimer)
        this.portTimer = null
    }

    async checkPortNow (): Promise<void> {
        const ok = await this.probe(8443, 5000)
        this.portState = ok ? 'ok' : 'fail'
        if (ok) {
            this.stopPortPolling()
            this.stopClock()
        }
    }

    // ---- Closing ----

    async canClose (): Promise<boolean> {
        if (this.step !== 'install' || this.savedConfirmed) {
            return true
        }
        return this.confirm({
            title: this.s('closeTitle'),
            lines: [this.s('closeBody1'), this.s('closeBody2')],
            okText: this.s('closeConfirm'),
            cancelText: this.s('closeBack'),
            danger: true,
        })
    }

    private stopClock (): void {
        clearInterval(this.clock)
        this.clock = null
    }

    private stopInstallHelpers (): void {
        this.stopClock()
        this.stopPortPolling()
        this.portState = 'idle'
        if (this.powerBlocker !== null) {
            this.electron.powerSaveBlocker.stop(this.powerBlocker)
            this.powerBlocker = null
        }
    }
}
