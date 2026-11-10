// Quick actions (stage 4). Commands are the registered `wpp` interface (docs/integrations/wp-panel.md,
// WP Panel executor/wp_command.go). None of them is interactive or long-running.
import { StringKey } from '../i18n'

export interface QuickAction {
    id: string
    label: StringKey
    desc: StringKey
    command: string
    /** Needs an in-app confirmation first (wpp password resets immediately, with no prompt of its own). */
    confirm?: boolean
    /** Hint shown in the left pane after running. */
    hint?: StringKey
}

export const QUICK_ACTIONS: QuickAction[] = [
    { id: 'info', label: 'actInfo', desc: 'actInfoDesc', command: 'wpp', hint: 'hintInfo' },
    { id: 'password', label: 'actPassword', desc: 'actPasswordDesc', command: 'wpp password', confirm: true, hint: 'hintPassword' },
    { id: 'unban', label: 'actUnban', desc: 'actUnbanDesc', command: 'wpp unban' },
    { id: 'restart', label: 'actRestart', desc: 'actRestartDesc', command: 'wpp restart' },
    { id: 'status', label: 'actStatus', desc: 'actStatusDesc', command: 'wpp status' },
    { id: 'log', label: 'actLog', desc: 'actLogDesc', command: 'wpp log' },
]

export function withSudo (command: string, isRoot: boolean): string {
    return isRoot ? command : `sudo ${command}`
}
