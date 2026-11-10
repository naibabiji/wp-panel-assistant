/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
// WP Panel Assistant: rewritten for beginners (ADR-0005 item 1; stage 2 design confirmed 2026-11-10).
// - First connection: "Trust and connect" / "Cancel".
// - Changed key: explain causes and risk, show old/new fingerprints, default is "Disconnect",
//   updating requires ticking a confirmation box. No "accept just this once".
import { Component, Input } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { TranslateService } from 'tabby-core'
import { KnownHost, KnownHostSelector, SSHKnownHostsService } from '../services/sshKnownHosts.service'
import { hostKeyLang, hostKeyText, HostKeyTextKey } from './hostKeyPromptText'

/** @hidden */
@Component({
    templateUrl: './hostKeyPromptModal.component.pug',
    // The upstream theme draws an unchecked checkbox white-on-white in light mode; give it a visible border.
    styles: [':host ::ng-deep .form-check-input:not(:checked) { border-color: rgba(127, 127, 127, .7) !important; }'],
})
export class HostKeyPromptModalComponent {
    @Input() selector: KnownHostSelector
    @Input() digest: string
    knownHost: KnownHost|null
    isMismatched = false
    isUnknown = false
    confirmed = false
    saving = false
    saveError: string|null = null
    private lang: 'zh'|'en'

    constructor (
        private knownHosts: SSHKnownHostsService,
        private modalInstance: NgbActiveModal,
        translate: TranslateService,
    ) {
        this.lang = hostKeyLang(translate.defaultLang)
    }

    ngOnInit () {
        this.knownHost = this.knownHosts.getFor(this.selector)
        if (!this.knownHost) {
            this.isUnknown = true
        } else if (this.knownHost.digest !== this.digest) {
            this.isMismatched = true
        }
    }

    t (key: HostKeyTextKey): string {
        return hostKeyText(key, this.lang)
            .replace('%host', this.selector.host)
            .replace('%port', String(this.selector.port))
    }

    /** Same notation as `ssh-keygen -l` and most VPS consoles. */
    format (digest?: string|null): string {
        return digest ? `SHA256:${digest.replace(/=+$/, '')}` : ''
    }

    async acceptAndSave () {
        if (this.isMismatched && !this.confirmed || this.saving) {
            return
        }
        this.saving = true
        this.saveError = null
        try {
            await this.knownHosts.store(this.selector, this.digest)
        } catch (error) {
            this.saveError = this.t('saveFailed').replace('%error', String(error?.message ?? error))
            return
        } finally {
            this.saving = false
        }
        this.modalInstance.close(true)
    }

    cancel () {
        this.modalInstance.close(false)
    }
}
