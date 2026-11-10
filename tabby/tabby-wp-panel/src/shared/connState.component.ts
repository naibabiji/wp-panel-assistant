import { Component, Input } from '@angular/core'
import { ServerTabBase } from './serverTabBase'

/** Connecting / unreachable / failed states shared by the install wizard and the manage page. */
@Component({
    selector: 'wpp-conn-state',
    templateUrl: './connState.pug',
    styleUrls: ['./serverTab.component.scss'],
})
export class ConnStateComponent {
    @Input() tab: ServerTabBase
}
