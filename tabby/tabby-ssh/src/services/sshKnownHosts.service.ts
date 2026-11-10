import { Injectable } from '@angular/core'
import { ConfigService } from 'tabby-core'

export interface KnownHostSelector {
    host: string
    port: number
    type: string
}

export interface KnownHost extends KnownHostSelector {
    digest: string
}

@Injectable({ providedIn: 'root' })
export class SSHKnownHostsService {
    constructor (
        private config: ConfigService,
    ) { }

    getFor (selector: KnownHostSelector): KnownHost|null {
        return this.config.store.ssh.knownHosts.find(x => x.host === selector.host && x.port === selector.port && x.type === selector.type) ?? null
    }

    async store (selector: KnownHostSelector, digest: string): Promise<void> {
        // WP Panel Assistant: wait for the save and roll back the in-memory record if it fails,
        // so the host key prompt can report the error (stage 2).
        const existing = this.getFor(selector)
        const previousDigest = existing?.digest
        if (existing) {
            existing.digest = digest
        } else {
            this.config.store.ssh.knownHosts.push({ ...selector, digest })
        }
        try {
            await this.config.save()
        } catch (error) {
            if (existing) {
                existing.digest = previousDigest!
            } else {
                const list = this.config.store.ssh.knownHosts
                const index = list.findIndex(x => x.host === selector.host && x.port === selector.port && x.type === selector.type)
                if (index !== -1) {
                    list.splice(index, 1)
                }
            }
            throw error
        }
    }
}
