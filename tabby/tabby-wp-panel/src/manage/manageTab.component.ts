import { Component, Injector } from '@angular/core'
import { SSHProfile, SSHTabComponent } from 'tabby-ssh'
import { StringKey } from '../i18n'
import { ServerTabBase } from '../shared/serverTabBase'
import { QUICK_ACTIONS, QuickAction, withSudo } from './actions'

type Step = 'form' | 'connected'

interface SavedServer {
    id: string
    name: string
    profile: any
}

/** Manage WP Panel (stage 4): pick a server, then run `wpp` quick actions in the terminal on the right. */
@Component({
    selector: 'wp-panel-manage-tab',
    templateUrl: './manageTab.component.pug',
    styleUrls: ['../shared/serverTab.component.scss'],
    styles: [':host { display: flex; flex: 1 1 auto; width: 100%; height: 100%; overflow-y: auto; }'],
})
export class ManageTabComponent extends ServerTabBase {
    step: Step = 'form'
    actions = QUICK_ACTIONS
    savedServers: SavedServer[] = []
    selectedServer = ''
    lastAction: QuickAction|null = null
    /** Set after "Forgot login password" ran; cleared when the user ticks "I have saved the new passwords". */
    resetPending = false
    savedConfirmed = false

    // A getter (not a readonly field) so the base constructor can read it.
    // eslint-disable-next-line @typescript-eslint/class-literal-property-style
    protected get titleKey (): StringKey { return 'manageTab' }
    protected get terminalWanted (): boolean { return this.step === 'connected' }

    constructor (injector: Injector) {
        super(injector)
        this.sudoHintKey = 'sudoHintManage'
        this.loadSavedServers()
    }

    private listSavedServers (): SavedServer[] {
        return (this.config.store.profiles as any[])
            .filter(p => p.type === 'ssh' && !p.isTemplate && p.options?.host)
            .map(p => {
                // Show user@host[:port] rather than the profile name, so servers differing only by port are distinguishable.
                const port = p.options.port ?? 22
                return { id: p.id, name: `${p.options.user ?? 'root'}@${p.options.host}${port === 22 ? '' : ':' + port}`, profile: p }
            })
    }

    private loadSavedServers (): void {
        this.savedServers = this.listSavedServers()
        if (this.savedServers.length) {
            this.selectedServer = this.savedServers[0].id
            this.pickServer()
        }
    }

    async pickServer (): Promise<void> {
        const server = this.savedServers.find(x => x.id === this.selectedServer)
        if (!server) {
            return
        }
        const o = server.profile.options
        this.host = o.host
        this.port = o.port ?? 22
        this.user = o.user ?? 'root'
        this.authMethod = o.auth === 'publicKey' ? 'publicKey' : 'password'
        this.privateKey = o.privateKeys?.[0] ?? null
        this.password = ''
        this.errors = {}
        this.hasStoredPassword = false
        try {
            this.hasStoredPassword = await this.passwordStorage.loadPassword({ options: o } as SSHProfile, this.user) !== null
        } catch {
            // No credential store available: the user types the password.
        }
        // Reflect the stored state; typing a new password with this ticked replaces the stored one.
        this.rememberPassword = this.hasStoredPassword
    }

    // ---- Connect ----

    async connect (): Promise<void> {
        if (!this.validate()) {
            return
        }
        this.step = 'connected'
        this.lastAction = null
        await this.saveServer()
        await this.openTerminal()
    }

    async backToForm (): Promise<void> {
        if (!await this.confirmLeave()) {
            return
        }
        this.removeTerminal()
        this.resetPending = false
        this.step = 'form'
        this.loadSavedServersKeepSelection()
    }

    private loadSavedServersKeepSelection (): void {
        const current = { host: this.hostTrimmed, port: Number(this.port), user: this.user.trim() }
        this.savedServers = this.listSavedServers()
        const match = this.savedServers.find(x => x.profile.options.host === current.host &&
            (x.profile.options.port ?? 22) === current.port && x.profile.options.user === current.user)
        this.selectedServer = match?.id ?? ''
    }

    protected onConnected (_tab: SSHTabComponent): void {
        // Nothing to type automatically; the user picks an action.
    }

    // ---- Actions ----

    async run (action: QuickAction): Promise<void> {
        if (this.state !== 'running') {
            return
        }
        if (action.confirm && !await this.confirm({
            title: this.s('pwConfirmTitle'),
            lines: [this.s('pwConfirmBody1'), this.s('pwConfirmBody2')],
            okText: this.s('pwConfirmOk'),
            cancelText: this.s('cancel'),
            danger: true,
        })) {
            return
        }
        if (!this.sendNow(withSudo(action.command, this.isRoot))) {
            return
        }
        this.lastAction = action
        if (action.id === 'password') {
            this.resetPending = true
            this.savedConfirmed = false
        }
    }

    // ---- Closing ----

    private confirmLeave (): Promise<boolean> {
        if (!this.resetPending || this.savedConfirmed) {
            return Promise.resolve(true)
        }
        return this.confirm({
            title: this.s('closeResetTitle'),
            lines: [this.s('closeResetBody')],
            okText: this.s('closeConfirm'),
            cancelText: this.s('closeBack'),
            danger: true,
        })
    }

    async canClose (): Promise<boolean> {
        return this.confirmLeave()
    }
}
