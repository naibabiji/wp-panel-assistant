// Shared base for the install wizard (stage 3) and the manage page (stage 4):
// server form, saved server profile, SSH port pre-check, SSH terminal in the right pane of a split tab,
// connection state, and an in-app confirm dialog.
// Like Tabby's BaseTabComponent, services are fetched from the injector so subclasses only pass `injector`.
import { Injector } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { Subscription } from 'rxjs'
import { debounceTime, first, timeout } from 'rxjs/operators'
import * as net from 'net'
import {
    AppService, BaseTabComponent, FileProvidersService, LocaleService, PlatformService,
    ProfilesService, SplitTabComponent, TabsService, TranslateService,
} from 'tabby-core'
import { PasswordStorageService, SSHProfile, SSHTabComponent } from 'tabby-ssh'
import { detectLang, Lang, StringKey, t } from '../i18n'
import { FieldError, Region, validateServer } from '../install/commands'
import { PORT_GUIDE_URL, REINSTALL_URL, VPS_INFO_URL } from '../links'
import { ConfirmModalComponent } from './confirmModal.component'


export type ConnState = 'connecting' | 'running' | 'unreachable' | 'connectFailed' | 'disconnected'
type FieldKey = 'host'|'port'|'user'|'password'|'key'

export abstract class ServerTabBase extends BaseTabComponent {
    lang: Lang

    host = ''
    port = 22
    user = 'root'
    authMethod: 'password'|'publicKey' = 'password'
    password = ''
    showPassword = false
    rememberPassword = false
    privateKey: string|null = null
    errors: Partial<Record<FieldKey, StringKey>> = {}
    /** Install wizard shows the server-location row; the manage page does not. */
    showRegion = false
    region: Region = 'overseas'
    /** Manage page: a password for this server is already in the OS credential store, so the field may stay empty. */
    hasStoredPassword = false
    sudoHintKey: StringKey = 'sudoHint'

    state: ConnState = 'connecting'

    protected terminal: SSHTabComponent|null = null
    protected terminalSubs: Subscription[] = []

    protected app: AppService
    protected tabsService: TabsService
    protected profiles: ProfilesService
    protected platform: PlatformService
    protected fileProviders: FileProvidersService
    protected passwordStorage: PasswordStorageService
    protected ngbModal: NgbModal

    /** Tab title key (a getter, so it is available inside this constructor). */
    protected abstract get titleKey (): StringKey
    /** True while the page is in the step that owns a terminal. */
    protected abstract get terminalWanted (): boolean
    /** Called after every successful connection attempt (first one, Tabby's "Reconnect", ours). */
    protected abstract onConnected (tab: SSHTabComponent): void

    constructor (injector: Injector) {
        super(injector)
        this.app = injector.get(AppService)
        this.tabsService = injector.get(TabsService)
        this.profiles = injector.get(ProfilesService)
        this.platform = injector.get(PlatformService)
        this.fileProviders = injector.get(FileProvidersService)
        this.passwordStorage = injector.get(PasswordStorageService)
        this.ngbModal = injector.get(NgbModal)
        const translate = injector.get(TranslateService)
        const locale = injector.get(LocaleService)
        this.applyLang(translate.defaultLang)
        this.subscribeUntilDestroyed(locale.localeChanged$, lang => this.applyLang(lang))
        this.destroyed$.subscribe(() => {
            this.password = ''
            this.passwordToRemember = null
            this.removeTerminal()
        })
    }

    private applyLang (lang?: string|null): void {
        this.lang = detectLang(lang)
        this.setTitle(t(this.titleKey, this.lang))
    }

    s (key: StringKey, arg?: string): string {
        const text = t(key, this.lang)
        return arg === undefined ? text : text.replace('%s', arg)
    }

    get isRoot (): boolean { return this.user.trim() === 'root' }
    get hostTrimmed (): string { return this.host.trim() }

    openGuide (e: Event, which: 'vpsInfo'|'reinstall'|'port' = 'vpsInfo'): void {
        e.preventDefault()
        this.platform.openExternal({ vpsInfo: VPS_INFO_URL, reinstall: REINSTALL_URL, port: PORT_GUIDE_URL }[which])
    }

    async chooseKey (): Promise<void> {
        const ref = await this.fileProviders.selectAndStoreFile('private key').catch(() => null)
        if (ref) {
            this.privateKey = ref
            delete this.errors.key
        }
    }

    get keyName (): string {
        return this.privateKey ? this.privateKey.replace(/^file:\/\//, '').split(/[\\/]/).pop() ?? '' : ''
    }

    protected validate (): boolean {
        const e: Partial<Record<FieldKey, StringKey>> = validateServer(this.hostTrimmed, Number(this.port), this.user.trim()) as Record<string, FieldError>
        if (this.authMethod === 'password' && !this.password && !this.hasStoredPassword) {
            e.password = 'errPassword'
        }
        if (this.authMethod === 'publicKey' && !this.privateKey) {
            e.key = 'errKey'
        }
        this.errors = e
        return Object.keys(e).length === 0
    }

    // ---- Server profile (no password in config; password only in the OS credential store when chosen) ----

    protected profileOptions (): Partial<SSHProfile['options']> {
        return {
            host: this.hostTrimmed,
            port: Number(this.port),
            user: this.user.trim(),
            auth: this.authMethod,
            privateKeys: this.authMethod === 'publicKey' && this.privateKey ? [this.privateKey] : [],
            // Unreachable servers (wrong IP, blocked security group) silently drop packets; do not wait forever.
            readyTimeout: 20000,
        }
    }

    /** Save the server to the connection list. Failures are logged and never block the flow. */
    protected async saveServer (): Promise<void> {
        const o = this.profileOptions()
        try {
            const existing = this.config.store.profiles.find((p: any) => p.type === 'ssh' &&
                p.options?.host === o.host && (p.options?.port ?? 22) === o.port && p.options?.user === o.user)
            if (existing) {
                existing.options.auth = o.auth
                existing.options.privateKeys = o.privateKeys
                existing.options.readyTimeout = o.readyTimeout
            } else {
                await this.profiles.newProfile({ type: 'ssh', name: `${o.user}@${o.host}`, options: o } as any)
            }
            await this.config.save()
        } catch (error) {
            console.warn('WP Panel Assistant: could not save the server to the connection list', error)
        }
        // The password is remembered only after it has logged in successfully (see onAttemptFinished), so a mistyped
        // password never replaces a working one.
        this.passwordToRemember = this.authMethod === 'password' && this.rememberPassword && this.password
            ? { options: o, password: this.password }
            : null
    }

    private passwordToRemember: { options: Partial<SSHProfile['options']>, password: string }|null = null

    private async rememberVerifiedPassword (): Promise<void> {
        const pending = this.passwordToRemember
        this.passwordToRemember = null
        if (!pending) {
            return
        }
        // A missing or locked credential store must not block anything; the password is still used for this session.
        try {
            await this.passwordStorage.savePassword({ options: pending.options } as SSHProfile, pending.password)
            this.hasStoredPassword = true
        } catch (error) {
            console.warn('WP Panel Assistant: could not save the password to the credential store', error)
        }
    }

    /** Session-only profile: a typed password stays in memory for this connection and is never written to config.
     *  With an empty password, Tabby uses the one stored in the OS credential store (if any). */
    private sessionProfile (): any {
        return {
            type: 'ssh',
            name: `${this.user.trim()}@${this.hostTrimmed}`,
            options: {
                ...this.profileOptions(),
                password: this.authMethod === 'password' && this.password ? this.password : undefined,
                warnOnClose: false,
            },
        }
    }

    // ---- Terminal (right pane) ----

    private findSplit (): SplitTabComponent|null {
        return this.app.tabs.find(tab => tab instanceof SplitTabComponent && tab.getAllTabs().includes(this)) as SplitTabComponent|undefined ?? null
    }

    protected async openTerminal (): Promise<void> {
        this.destroyTerminal()
        this.state = 'connecting'
        // Tabby has no timeout for the TCP connection itself; check the SSH port first so a wrong IP or a blocked
        // security group gives a clear message instead of waiting forever.
        if (!await this.probe(Number(this.port), 10000)) {
            if (this.terminalWanted && !this.terminal) {
                this.state = 'unreachable'
            }
            return
        }
        if (!this.terminalWanted) {
            return
        }
        const params = await this.profiles.newTabParametersForProfile(this.sessionProfile())
        const split = this.findSplit()
        if (!params || !split) {
            this.state = 'connectFailed'
            return
        }
        const tab = this.tabsService.create(params) as SSHTabComponent
        this.terminal = tab

        // Find out when each connection attempt (first one, Tabby's "Reconnect", ours) has finished.
        const original = tab.initializeSession.bind(tab)
        tab.initializeSession = async () => {
            this.state = 'connecting'
            await original()
            this.onAttemptFinished(tab)
        }
        this.terminalSubs.push(tab.destroyed$.subscribe(() => {
            if (this.terminal === tab) {
                this.terminal = null
                this.terminalSubs.forEach(s => s.unsubscribe())
                this.terminalSubs = []
                if (this.terminalWanted) {
                    this.state = 'disconnected'
                }
            }
        }))

        await split.addTab(tab, this, 'r')
        split.root.ratios = [0.36, 0.64]
        split.layout()
    }

    private onAttemptFinished (tab: SSHTabComponent): void {
        if (this.terminal !== tab) {
            return
        }
        const session = tab.session
        if (!session?.open) {
            this.state = 'connectFailed'
            return
        }
        this.state = 'running'
        // Remember the typed password only if it is the one that logged in (not one typed into Tabby's own prompt).
        if (tab.sshSession?.profilePasswordAccepted) {
            this.rememberVerifiedPassword()
        } else {
            this.passwordToRemember = null
        }
        this.terminalSubs.push(session.closed$.subscribe(() => {
            if (this.terminal === tab && this.terminalWanted) {
                this.state = 'disconnected'
            }
        }))
        this.onConnected(tab)
    }

    /** Type a command once the login banner has finished printing (1 s of quiet, at most 30 s). */
    protected sendWhenQuiet (tab: SSHTabComponent, command: string, afterSend?: () => void): void {
        const send = () => {
            if (this.terminal !== tab) {
                return
            }
            this.sendNow(command)
            afterSend?.()
        }
        this.terminalSubs.push(tab.output$.pipe(debounceTime(1000), first(), timeout(30000)).subscribe({ next: send, error: send }))
    }

    /** Type a command into the connected terminal. */
    protected sendNow (command: string): boolean {
        if (!this.terminal?.session?.open) {
            return false
        }
        this.terminal.sendInput(command + '\r')
        this.terminal.frontend?.focus()
        return true
    }

    /** Back to the server form (each page decides what else to reset). */
    abstract backToForm (): void|Promise<void>

    retryConnect (): void {
        if (this.terminal) {
            this.terminal.reconnect()
        } else {
            this.openTerminal()
        }
    }

    /** Leave the terminal step (back to the form, page closed): also drop any password waiting to be remembered. */
    protected removeTerminal (): void {
        this.passwordToRemember = null
        this.destroyTerminal()
    }

    private destroyTerminal (): void {
        const tab = this.terminal
        this.terminal = null
        this.terminalSubs.forEach(s => s.unsubscribe())
        this.terminalSubs = []
        tab?.destroy()
    }

    protected probe (port: number, timeoutMs: number): Promise<boolean> {
        return new Promise(resolve => {
            const socket = net.connect({ host: this.hostTrimmed, port })
            const done = (ok: boolean) => {
                socket.destroy()
                resolve(ok)
            }
            socket.setTimeout(timeoutMs)
            socket.on('connect', () => done(true))
            socket.on('timeout', () => done(false))
            socket.on('error', () => done(false))
        })
    }

    protected async confirm (inputs: Partial<ConfirmModalComponent>): Promise<boolean> {
        const modal = this.ngbModal.open(ConfirmModalComponent)
        Object.assign(modal.componentInstance, inputs)
        return modal.result.then(r => !!r, () => false)
    }
}
