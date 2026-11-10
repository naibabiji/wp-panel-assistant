// WP Panel Assistant: bilingual strings for the host key prompt (ADR-0005 item 1, ADR-0006 bilingual rule).
// Kept inside tabby-ssh because tabby-ssh cannot depend on the tabby-wp-panel plugin.

const TEXT = {
    unknownTitle: {
        zh: '第一次连接这台服务器',
        en: 'First connection to this server',
    },
    unknownBody: {
        zh: '这是你第一次连接 %host（端口 %port）。助手会记住这台服务器的身份标识（指纹），以后如果它变了，会提醒你。',
        en: 'This is your first connection to %host (port %port). The assistant will remember this server\'s identity (fingerprint) and warn you if it ever changes.',
    },
    unknownHint: {
        zh: '如果服务商控制台显示了指纹，可以对照一下；没有显示的话，直接继续即可。',
        en: 'If your provider\'s control panel shows a fingerprint, you can compare it. If not, just continue.',
    },
    serverFingerprint: { zh: '服务器指纹', en: 'Server fingerprint' },
    trustAndConnect: { zh: '信任并连接', en: 'Trust and connect' },
    cancel: { zh: '取消', en: 'Cancel' },

    changedTitle: {
        zh: '服务器身份发生了变化',
        en: 'The server\'s identity has changed',
    },
    changedBody: {
        zh: '你要连接的 %host（端口 %port）和上次连接时的"服务器身份标识"（指纹）不一样。',
        en: 'The identity (fingerprint) of %host (port %port) is different from the last time you connected.',
    },
    changedCauses: { zh: '常见原因：', en: 'Common reasons:' },
    causeReinstall: { zh: '你最近在服务商后台重装了系统', en: 'You recently reinstalled the system in your provider\'s control panel' },
    causeNewServer: { zh: '你换了新服务器，但沿用了同一个 IP', en: 'You switched to a new server that kept the same IP' },
    causeMigration: { zh: '服务商迁移了你的服务器', en: 'Your provider migrated your server' },
    changedRisk: {
        zh: '如果以上都没有发生，可能有人在冒充你的服务器或拦截连接，继续连接可能泄露你的密码。建议断开，并联系服务商确认。',
        en: 'If none of these happened, someone may be impersonating your server or intercepting the connection, and continuing could expose your password. Disconnect and check with your provider.',
    },
    lastFingerprint: { zh: '上次记录的指纹', en: 'Previously recorded fingerprint' },
    newFingerprint: { zh: '这次收到的指纹', en: 'Fingerprint received now' },
    confirmChange: { zh: '我确认最近重装过系统或更换了服务器', en: 'I confirm I recently reinstalled the system or replaced the server' },
    disconnect: { zh: '断开连接', en: 'Disconnect' },
    updateAndConnect: { zh: '更新指纹并继续连接', en: 'Update fingerprint and connect' },
    saveFailed: {
        zh: '指纹保存失败：%error。本次没有连接，请重试。',
        en: 'Could not save the fingerprint: %error. Not connected; please try again.',
    },

    // Terminal messages after the user declines.
    rejectedChanged: {
        zh: '已断开：服务器指纹与上次不同，没有连接。如果你确实重装了系统，请重新连接，在弹窗中勾选确认后更新。',
        en: 'Disconnected: the server fingerprint differs from last time, so no connection was made. If you did reinstall the system, reconnect and tick the confirmation box to update it.',
    },
    rejectedUnknown: {
        zh: '已取消：你没有信任这台服务器的指纹，没有连接。',
        en: 'Cancelled: you did not trust this server\'s fingerprint, so no connection was made.',
    },
}

// eslint-disable-next-line @typescript-eslint/no-type-alias
export type HostKeyTextKey = keyof typeof TEXT

export function hostKeyLang (currentLang?: string|null): 'zh'|'en' {
    const lang = (currentLang ?? navigator.language).toLowerCase()
    return lang.startsWith('zh') ? 'zh' : 'en'
}

export function hostKeyText (key: HostKeyTextKey, lang: 'zh'|'en'): string {
    return TEXT[key][lang]
}
