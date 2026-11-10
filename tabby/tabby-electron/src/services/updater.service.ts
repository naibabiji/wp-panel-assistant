import { Injectable } from '@angular/core'

import { UpdaterService } from 'tabby-core'

// WPPA: upstream automatic updates removed (ADR-0005). The upstream implementation checked
// GitHub releases of Eugeny/tabby and could replace WP Panel Assistant with upstream Tabby.
// New versions are downloaded manually by the user. This no-op keeps the UpdaterService contract.
@Injectable()
export class ElectronUpdaterService extends UpdaterService {
    async check (): Promise<boolean> {
        return false
    }

    async update (): Promise<void> {
        // no-op
    }
}
