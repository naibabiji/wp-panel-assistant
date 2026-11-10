import { Component, Input } from '@angular/core'
import { ServerTabBase } from './serverTabBase'

/** Server form shared by the install wizard and the manage page; all state lives on the page (`tab`). */
@Component({
    selector: 'wpp-server-form',
    templateUrl: './serverForm.pug',
    styleUrls: ['./serverTab.component.scss'],
})
export class ServerFormComponent {
    @Input() tab: ServerTabBase
}
