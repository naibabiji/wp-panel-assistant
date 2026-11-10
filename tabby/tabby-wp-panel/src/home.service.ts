import { Injectable } from '@angular/core'
import { AppService } from 'tabby-core'
import { HomeTabComponent } from './homeTab.component'

@Injectable({ providedIn: 'root' })
export class HomeService {
    constructor (private app: AppService) { }

    open (): void {
        const existing = this.app.tabs.find(tab => tab instanceof HomeTabComponent)
        if (existing) {
            this.app.selectTab(existing)
        } else {
            this.app.openNewTabRaw({ type: HomeTabComponent })
        }
    }
}
