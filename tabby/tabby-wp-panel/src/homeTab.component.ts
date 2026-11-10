import { Component, Injector } from '@angular/core'
import { AppService, BaseTabComponent, LocaleService, SplitTabComponent, TabComponentType, PartialProfile, PlatformService, Profile, ProfilesService, QuickConnectProfileProvider, SelectorOption, SelectorService, TranslateService } from 'tabby-core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { LOGO_DATA_URL } from './brand/logo'
import { detectLang, Lang, StringKey, t } from './i18n'
import { InstallTabComponent } from './install/installTab.component'
import { ManageTabComponent } from './manage/manageTab.component'
import { HELP_URL, PRIVACY_URL, SOURCE_URL, WEBSITE_URL } from './links'
import { ConfirmModalComponent } from './shared/confirmModal.component'
import { UpdateInfo, UpdateService } from './update.service'

/** WP Panel Assistant home page (stage 1). Install and Manage are placeholders until stages 3 and 4. */
@Component({
    selector: 'wp-panel-home-tab',
    template: `
<div class="wpp-home">
  <div class="wpp-update" *ngIf="update" id="wpp-update">
    <div class="wpp-update-text">{{ updateText }}</div>
    <div class="wpp-update-actions">
      <button class="btn btn-sm btn-secondary" (click)="showNotes()" id="wpp-update-notes">{{ s('updateNotes') }}</button>
      <button class="btn btn-sm btn-primary" (click)="open($event, update.github)" id="wpp-update-github">{{ s('updateGithub') }}</button>
      <button class="btn btn-sm btn-primary" (click)="open($event, update.website)" id="wpp-update-website">{{ s('updateWebsite') }}</button>
      <a href="#" class="ms-auto" (click)="skipUpdate($event)" id="wpp-update-skip">{{ s('updateSkip') }}</a>
    </div>
  </div>

  <div class="wpp-main">
    <img class="wpp-logo" [src]="logo" alt="">
    <h1 class="wpp-title">{{ s('appName') }}</h1>
    <div class="wpp-tagline text-muted">{{ s('tagline') }}</div>

    <button class="wpp-card wpp-primary" (click)="openInstall()" id="wpp-home-install">
      <i class="fas fa-rocket fa-fw wpp-icon"></i>
      <span class="wpp-text">
        <span class="wpp-label">{{ s('install') }}</span>
        <span class="wpp-sub">{{ s('installSub') }}</span>
      </span>
    </button>

    <div class="wpp-row">
      <button class="wpp-card" (click)="openManage()" id="wpp-home-manage">
        <i class="fas fa-tools fa-fw wpp-icon"></i>
        <span class="wpp-text">
          <span class="wpp-label">{{ s('manage') }}</span>
          <span class="wpp-sub">{{ s('manageSub') }}</span>
        </span>
      </button>
      <button class="wpp-card" (click)="connect()" id="wpp-home-connect">
        <i class="fas fa-terminal fa-fw wpp-icon"></i>
        <span class="wpp-text">
          <span class="wpp-label">{{ s('connect') }}</span>
          <span class="wpp-sub">{{ s('connectSub') }}</span>
        </span>
      </button>
    </div>

    <div class="wpp-trust" id="wpp-trust">
      <span><i class="fas fa-check"></i>{{ s('trustOpenSource') }}</span>
      <span><i class="fas fa-check"></i>{{ s('trustNoData') }}</span>
      <span><i class="fas fa-check"></i>{{ s('trustOwnServer') }}</span>
    </div>
    <div class="wpp-trust-links">
      <a href="#" (click)="open($event, sourceUrl)" id="wpp-view-source">{{ s('viewSource') }}</a>
      <span class="text-muted">·</span>
      <a href="#" (click)="open($event, privacyUrl)" id="wpp-privacy">{{ s('privacyPolicy') }}</a>
    </div>
  </div>

  <footer class="wpp-footer">
    <!-- Recommendation page: reserved slot, not developed yet (user decision 2026-11-09). -->
    <a href="#" (click)="open($event, helpUrl)" id="wpp-home-help">{{ s('help') }}</a>
    <a href="#" (click)="open($event, websiteUrl)" id="wpp-home-website">{{ s('website') }}</a>
    <span class="ms-auto text-muted">{{ s('version') }} {{ version }}</span>
    <a href="#" (click)="checkNow($event)" id="wpp-check-updates">{{ s('checkUpdates') }}</a>
    <span *ngIf="checkStatus" class="text-muted" id="wpp-check-status">{{ checkStatus }}</span>
    <label class="wpp-auto-check text-muted">
      <input type="checkbox" class="form-check-input" [(ngModel)]="autoCheck" id="wpp-auto-check">
      {{ s('autoCheckUpdates') }}
    </label>
  </footer>
</div>
`,
    styles: [`
:host { display: flex; flex: 1 1 auto; width: 100%; height: 100%; overflow-y: auto; font-size: 13px; } /* shared type scale, see installTab.component.scss */
.wpp-home { display: flex; flex-direction: column; width: 100%; min-height: 100%; }
.wpp-main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 16px; }
.wpp-logo { width: 80px; height: 80px; margin-bottom: 10px; }
.wpp-title { margin: 0 0 4px; font-size: 22px; font-weight: 600; }
.wpp-tagline { margin-bottom: 24px; }
.wpp-card {
  display: flex; align-items: center; gap: 14px; width: 100%; text-align: left;
  padding: 16px 18px; border-radius: 10px; border: 1px solid rgba(127,127,127,.3);
  background: rgba(127,127,127,.08); color: inherit; cursor: pointer;
}
.wpp-card:hover:not([disabled]) { background: rgba(127,127,127,.16); }
.wpp-card[disabled] { opacity: .55; cursor: default; }
.wpp-primary { max-width: 520px; padding: 22px; border-color: #1eaa7f; background: rgba(30,170,127,.12); }
.wpp-primary .wpp-label { font-size: 16px; }
.wpp-row { display: flex; gap: 12px; width: 100%; max-width: 520px; margin-top: 12px; }
.wpp-row .wpp-card { flex: 1; }
.wpp-icon { font-size: 20px; color: #1eaa7f; }
.wpp-text { display: flex; flex-direction: column; flex: 1; }
.wpp-label { font-weight: 600; font-size: 14px; }
.wpp-badge { display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; vertical-align: middle; background: rgba(127,127,127,.25); }
.wpp-sub { font-size: 12px; opacity: .75; }
.wpp-trust { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 20px; margin-top: 20px; font-weight: 600; }
.wpp-trust i { color: #1eaa7f; margin-right: 6px; }
.wpp-trust-links { display: flex; gap: 8px; margin-top: 6px; font-size: 12px; }
.wpp-footer { display: flex; flex-wrap: wrap; gap: 6px 18px; align-items: center; font-size: 12px; padding: 10px 20px; border-top: 1px solid rgba(127,127,127,.2); }
.wpp-auto-check { display: flex; align-items: center; gap: 6px; margin: 0; cursor: pointer; }
.wpp-auto-check input { margin: 0; }
.wpp-update { padding: 10px 20px; border-bottom: 1px solid rgba(30,170,127,.5); background: rgba(30,170,127,.12); }
.wpp-update-text { font-weight: 600; margin-bottom: 6px; }
.wpp-update-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
@media (max-width: 560px) { .wpp-row { flex-direction: column; } }
`],
})
export class HomeTabComponent extends BaseTabComponent {
    logo = LOGO_DATA_URL
    lang: Lang
    version: string
    helpUrl = HELP_URL
    websiteUrl = WEBSITE_URL
    sourceUrl = SOURCE_URL
    privacyUrl = PRIVACY_URL
    update: UpdateInfo|null = null
    checkStatus = ''

    constructor (
        injector: Injector,
        private app: AppService,
        private platform: PlatformService,
        private profiles: ProfilesService,
        private selector: SelectorService,
        private updates: UpdateService,
        private ngbModal: NgbModal,
        translate: TranslateService,
        locale: LocaleService,
    ) {
        super(injector)
        this.version = platform.getAppVersion()
        // Tabby sets the UI language with setDefaultLang() after config loads; follow its locale changes.
        this.applyLang(translate.defaultLang)
        this.subscribeUntilDestroyed(locale.localeChanged$, lang => this.applyLang(lang))
        this.subscribeUntilDestroyed(updates.available$, info => this.update = info)
    }

    // ---- Update notice ----

    get updateText (): string {
        return this.s('updateAvailable').replace('%s', this.update?.version ?? '').replace('%c', this.version)
    }

    get autoCheck (): boolean {
        return this.updates.autoEnabled
    }

    set autoCheck (value: boolean) {
        this.updates.autoEnabled = value
    }

    showNotes (): void {
        if (!this.update) {
            return
        }
        const modal = this.ngbModal.open(ConfirmModalComponent)
        const instance = modal.componentInstance as ConfirmModalComponent
        instance.title = this.s('updateNotesTitle').replace('%s', this.update.version)
        instance.lines = this.update.notes[this.lang].split('\n').filter(x => x.trim())
        instance.cancelText = this.s('closeDialog')
        modal.result.catch(() => null)
    }

    skipUpdate (e: Event): void {
        e.preventDefault()
        if (this.update) {
            this.updates.skip(this.update.version)
        }
    }

    async checkNow (e: Event): Promise<void> {
        e.preventDefault()
        if (this.checkStatus === this.s('checkingUpdates')) {
            return
        }
        this.checkStatus = this.s('checkingUpdates')
        const result = await this.updates.manualCheck()
        this.checkStatus = result === 'available' ? '' : result === 'latest' ? this.s('upToDate') : this.s('updateCheckFailed')
    }

    private applyLang (lang?: string|null): void {
        this.lang = detectLang(lang)
        this.setTitle(t('homeTab', this.lang))
    }

    s (key: StringKey): string {
        return t(key, this.lang)
    }

    openInstall (): void {
        this.openWizard(InstallTabComponent)
    }

    openManage (): void {
        this.openWizard(ManageTabComponent)
    }

    /** Install / manage pages: one each per window; they live in a split tab so the terminal can open on their right. */
    private openWizard (type: TabComponentType<BaseTabComponent>): void {
        const existing = this.app.tabs.find(tab => tab instanceof SplitTabComponent && tab.getAllTabs().some(x => x instanceof type))
        if (existing) {
            this.app.selectTab(existing)
        } else {
            this.app.openNewTab({ type })
        }
    }

    open (e: Event, url: string): void {
        e.preventDefault()
        this.platform.openExternal(url)
    }

    /** SSH-only selector: saved SSH servers plus quick connect (user@host[:port]). Local shells are not listed. */
    async connect (): Promise<void> {
        if (this.selector.active) { return }
        const profile = await new Promise<PartialProfile<Profile>|null>(async resolve => {
            const ssh = (await this.profiles.getProfiles()).filter(p => p.type === 'ssh' && !p.isTemplate)
            const options: SelectorOption<void>[] = ssh.map(p => ({
                ...this.profiles.selectorOptionForProfile(p) as SelectorOption<void>,
                callback: () => resolve(p),
            }))
            const provider = this.profiles.getProviders().find(p => p.id === 'ssh')
            if (provider instanceof QuickConnectProfileProvider) {
                options.push({
                    name: this.s('quickConnect'),
                    freeInputPattern: this.s('quickConnectPattern'),
                    icon: 'fas fa-arrow-right',
                    weight: -1,
                    callback: query => resolve(provider.quickConnect(query ?? '')),
                })
            }
            this.selector.show(this.s('connectPrompt'), options).catch(() => resolve(null))
        })
        if (profile) {
            await this.profiles.openNewTabForProfile(profile)
        }
    }
}
