// WP Panel Assistant plugin (GPL-3.0).
// Each UI feature is added only after its interaction design is confirmed by the user (see AGENTS.md).
import { Injectable, NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import TabbyCoreModule, { AppService, ConfigProvider, ConfigService, ToolbarButton, ToolbarButtonProvider, TranslateService } from 'tabby-core'
import { HomeTabComponent } from './homeTab.component'
import { HomeService } from './home.service'
import { WpPanelConfigProvider } from './config'
import { UpdateService } from './update.service'
import { applyTerminalLookOnce, WpPanelColorSchemes } from './terminalLook'
import { TerminalColorSchemeProvider } from 'tabby-terminal'
import { InstallTabComponent } from './install/installTab.component'
import { ManageTabComponent } from './manage/manageTab.component'
import { ConfirmModalComponent } from './shared/confirmModal.component'
import { ServerFormComponent } from './shared/serverForm.component'
import { ConnStateComponent } from './shared/connState.component'
import { LOGO_DATA_URL } from './brand/logo'
import { detectLang, t } from './i18n'

const HOME_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M575.8 255.5c0 18-15 32.1-32 32.1h-32l.7 160.2c0 2.7-.2 5.4-.5 8.1V472c0 22.1-17.9 40-40 40H456c-1.1 0-2.2 0-3.3-.1-1.4 .1-2.8 .1-4.2 .1H416 392c-22.1 0-40-17.9-40-40V448 384c0-17.7-14.3-32-32-32H256c-17.7 0-32 14.3-32 32v64 24c0 22.1-17.9 40-40 40H160 128.1c-1.5 0-3-.1-4.5-.2-1.2 .1-2.4 .2-3.6 .2H104c-22.1 0-40-17.9-40-40V360c0-.9 0-1.9 .1-2.8V287.6H32c-18 0-32-14-32-32.1 0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L564.8 231.5c8 7 12 15 11 24z"/></svg>'

/** Home button: left of the tab bar, and also listed on Tabby's start page when all tabs are closed. */
@Injectable()
export class HomeButtonProvider extends ToolbarButtonProvider {
    constructor (private home: HomeService, private translate: TranslateService) { super() }

    provide (): ToolbarButton[] {
        return [{
            icon: HOME_ICON,
            title: t('appName', detectLang(this.translate.defaultLang)),
            weight: -10,
            click: () => this.home.open(),
        }]
    }
}

@NgModule({
    imports: [CommonModule, FormsModule, TabbyCoreModule],
    providers: [
        { provide: ToolbarButtonProvider, useClass: HomeButtonProvider, multi: true },
        { provide: ConfigProvider, useClass: WpPanelConfigProvider, multi: true },
        { provide: TerminalColorSchemeProvider, useClass: WpPanelColorSchemes, multi: true },
    ],
    declarations: [HomeTabComponent, InstallTabComponent, ManageTabComponent, ConfirmModalComponent, ServerFormComponent, ConnStateComponent],
})
export default class WpPanelModule { // eslint-disable-line @typescript-eslint/no-extraneous-class
    constructor (app: AppService, config: ConfigService, home: HomeService, updates: UpdateService) {
        // The upstream theme draws unchecked checkboxes/radios white-on-white in light mode; give them a visible border (stage 3, user approved).
        // Brand logo wherever Tabby shows its own logo (loading screen, settings, start page).
        const style = document.createElement('style')
        style.textContent = `.tabby-logo { background-image: url("${LOGO_DATA_URL}") !important; background-size: contain !important; background-repeat: no-repeat !important; background-position: center !important; }\nsettings-tab .tabby-title { font-size: 1.8rem; line-height: 1.2; margin-top: .5rem; }\n.form-check-input:not(:checked) { border-color: rgba(127, 127, 127, .7) !important; }`
        document.head.appendChild(style)

        applyTerminalLookOnce(config)

        // Show the home page on startup (replaces the upstream welcome tab and auto-opened local terminal).
        app.ready$.subscribe(() => {
            config.ready$.toPromise().then(() => {
                home.open()
                updates.autoCheck() // once per start, release builds only, silent on failure (update notice, 2026-11-10)
            })
        })
    }
}
