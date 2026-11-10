import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

/** In-app confirmation dialog (stage 3). The safe choice is the focused default; Esc and clicking outside also choose it. */
@Component({
    template: `
<div class="modal-header"><h3 class="m-0">{{ title }}</h3></div>
<div class="modal-body">
  <p *ngFor="let line of lines">{{ line }}</p>
  <pre *ngIf="command" class="wpp-command">{{ command }}</pre>
</div>
<div class="modal-footer">
  <button #cancelButton class="btn btn-primary" ngbAutofocus (click)="close(false)" id="wpp-confirm-cancel">{{ cancelText }}</button>
  <button *ngIf="okText" class="btn" [class.btn-danger]="danger" [class.btn-secondary]="!danger" (click)="close(true)" id="wpp-confirm-ok">{{ okText }}</button>
</div>
`,
    styles: [`
:host { font-size: 13px; }
.modal-header h3 { font-size: 16px; font-weight: 600; }
.wpp-command { white-space: pre-wrap; word-break: break-all; user-select: text; padding: 8px 10px; border-radius: 6px; background: rgba(127,127,127,.12); font-size: 12px; }
`],
})
export class ConfirmModalComponent implements AfterViewInit {
    @ViewChild('cancelButton') cancelButton: ElementRef<HTMLButtonElement>
    @Input() title: string
    @Input() lines: string[] = []
    @Input() command: string|null = null
    @Input() okText = '' // empty: information dialog with a single (cancel) button
    @Input() cancelText: string
    @Input() danger = false

    constructor (private modal: NgbActiveModal) { }

    /** The terminal keeps grabbing focus; make sure keys go to this dialog, never to the server shell. */
    ngAfterViewInit (): void {
        for (const delay of [0, 100, 300]) {
            setTimeout(() => this.cancelButton.nativeElement.focus(), delay)
        }
    }

    close (result: boolean): void {
        this.modal.close(result)
    }
}
