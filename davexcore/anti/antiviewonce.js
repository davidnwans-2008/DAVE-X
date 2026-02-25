const { downloadContentFromMessage, downloadMediaMessage, getContentType, normalizeMessageContent } = require('@whiskeysockets/baileys');
const { getOwnerConfig, setOwnerConfig, getGroupConfig, parseToggleCommand } = require('../../Database/settingsStore');
const db = require('../../Database/database');
const { createFakeContact, getBotName } = require('../../davelib/fakeContact');
const { getPrefix } = require('../owner/setprefix');

function normalizeOwnerConfig(raw) {
    if (!raw || typeof raw !== 'object') {
        return { gc: { enabled: false, mode: 'private' }, pm: { enabled: false, mode: 'private' } };
    }
    if (raw.gc && raw.pm) return raw;
    const enabled = raw.enabled !== undefined ? raw.enabled : false;
    const mode = raw.mode || 'private';
    return { gc: { enabled, mode }, pm: { enabled, mode } };
}

function getEffectiveConfig(chatId) {
    const isGroup = chatId.endsWith('@g.us');
    if (isGroup) {
        if (db.hasGroupSetting(chatId, 'antiviewonce')) {
            const groupConf = getGroupConfig(chatId, 'antiviewonce');
            if (typeof groupConf === 'object' && groupConf.enabled !== undefined) {
                return groupConf;
            }
        }
        const ownerRaw = getOwnerConfig('antiviewonce');
        const ownerConf = normalizeOwnerConfig(ownerRaw);
        return { enabled: ownerConf.gc.enabled, mode: ownerConf.gc.mode };
    } else {
        const ownerRaw = getOwnerConfig('antiviewonce');
        const ownerConf = normalizeOwnerConfig(ownerRaw);
        return { enabled: ownerConf.pm.enabled, mode: ownerConf.pm.mode };
    }
}

// Detect and extract viewonce media — mirrors the approach in the existing vv2 command
function extractViewonce(message) {
    const m = message.message || {};

    // --- Direct viewOnce wrappers ---
    // Try V2 first (newest format)
    const v2 = m.viewOnceMessageV2?.message || m.viewOnceMessageV2Extension?.message;
    if (v2) {
        const img = v2.imageMessage;
        const vid = v2.videoMessage;
        const aud = v2.audioMessage;
        if (img) { console.log('[ANTIVIEWONCE] viewOnceMessageV2 image'); return { media: img, type: 'image' }; }
        if (vid) { console.log('[ANTIVIEWONCE] viewOnceMessageV2 video'); return { media: vid, type: 'video' }; }
        if (aud) { console.log('[ANTIVIEWONCE] viewOnceMessageV2 audio'); return { media: aud, type: 'audio' }; }
    }

    // Old format
    const vom = m.viewOnceMessage?.message;
    if (vom) {
        const img = vom.imageMessage;
        const vid = vom.videoMessage;
        const aud = vom.audioMessage;
        if (img) { console.log('[ANTIVIEWONCE] viewOnceMessage image'); return { media: img, type: 'image' }; }
        if (vid) { console.log('[ANTIVIEWONCE] viewOnceMessage video'); return { media: vid, type: 'video' }; }
        if (aud) { console.log('[ANTIVIEWONCE] viewOnceMessage audio'); return { media: aud, type: 'audio' }; }
    }

    // Ephemeral-wrapped viewonce (disappearing message groups)
    const eph = m.ephemeralMessage?.message;
    if (eph) {
        const ev2 = eph.viewOnceMessageV2?.message || eph.viewOnceMessageV2Extension?.message;
        if (ev2) {
            const img = ev2.imageMessage;
            const vid = ev2.videoMessage;
            const aud = ev2.audioMessage;
            if (img) { console.log('[ANTIVIEWONCE] ephemeral→v2 image'); return { media: img, type: 'image' }; }
            if (vid) { console.log('[ANTIVIEWONCE] ephemeral→v2 video'); return { media: vid, type: 'video' }; }
            if (aud) { console.log('[ANTIVIEWONCE] ephemeral→v2 audio'); return { media: aud, type: 'audio' }; }
        }
        const evm = eph.viewOnceMessage?.message;
        if (evm) {
            const img = evm.imageMessage;
            const vid = evm.videoMessage;
            const aud = evm.audioMessage;
            if (img) { console.log('[ANTIVIEWONCE] ephemeral→vom image'); return { media: img, type: 'image' }; }
            if (vid) { console.log('[ANTIVIEWONCE] ephemeral→vom video'); return { media: vid, type: 'video' }; }
            if (aud) { console.log('[ANTIVIEWONCE] ephemeral→vom audio'); return { media: aud, type: 'audio' }; }
        }
    }

    // --- Direct imageMessage/videoMessage with viewOnce flag ---
    if (m.imageMessage?.viewOnce) { console.log('[ANTIVIEWONCE] imageMessage.viewOnce'); return { media: m.imageMessage, type: 'image' }; }
    if (m.videoMessage?.viewOnce) { console.log('[ANTIVIEWONCE] videoMessage.viewOnce'); return { media: m.videoMessage, type: 'video' }; }
    if (m.audioMessage?.viewOnce) { console.log('[ANTIVIEWONCE] audioMessage.viewOnce'); return { media: m.audioMessage, type: 'audio' }; }

    // --- Fallback: normalizeMessageContent then re-check ---
    try {
        const norm = normalizeMessageContent(m);
        if (norm) {
            const ntype = getContentType(norm);
            if (ntype) {
                const nMsg = norm[ntype];
                if (nMsg?.viewOnce) {
                    const t = ntype.replace('Message', '');
                    console.log('[ANTIVIEWONCE] normalized viewOnce:', ntype);
                    return { media: nMsg, type: t };
                }
            }
        }
    } catch {}

    // --- Wrapper-only detection: if viewonce wrapper exists but inner imageMessage is null
    // Use the wrapper presence to know it's viewonce, and use downloadMediaMessage for actual download
    const hasViewonceWrapper = !!(m.viewOnceMessageV2 || m.viewOnceMessageV2Extension || m.viewOnceMessage ||
        m.ephemeralMessage?.message?.viewOnceMessageV2 || m.ephemeralMessage?.message?.viewOnceMessage);

    if (hasViewonceWrapper) {
        // Determine the likely type from the wrapper structure for logging
        console.log('[ANTIVIEWONCE] wrapper-only detection (inner null) — will use downloadMediaMessage');
        return { media: null, type: 'unknown', useMessageDownload: true };
    }

    return null;
}

async function downloadBuffer(msg, type) {
    const stream = await downloadContentFromMessage(msg, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

async function handleAntiviewonce(sock, message) {
    try {
        if (!message?.key || !message.message) return;
        if (message.key.fromMe) return;

        const chatId = message.key.remoteJid;
        if (!chatId || chatId === 'status@broadcast') return;

        const m = message.message;
        const rawKeys = Object.keys(m);

        // Quick pre-check: skip obvious non-media messages to keep logs clean
        const viewonceKeys = ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'imageMessage', 'videoMessage', 'audioMessage', 'ephemeralMessage'];
        const couldBeViewonce = rawKeys.some(k => viewonceKeys.includes(k));
        if (!couldBeViewonce) return;

        console.log('[ANTIVIEWONCE] Potential viewonce — keys:', rawKeys.join(', '));

        const config = getEffectiveConfig(chatId);
        if (!config?.enabled) {
            console.log('[ANTIVIEWONCE] Config disabled for:', chatId.endsWith('@g.us') ? 'group' : 'pm');
            return;
        }

        const found = extractViewonce(message);
        if (!found) {
            console.log('[ANTIVIEWONCE] No viewonce found in message');
            return;
        }

        const { media, type, useMessageDownload } = found;
        const botName = getBotName();
        const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const senderNumber = (message.key.participant || message.key.remoteJid).split('@')[0].split(':')[0];
        const mode = config.mode || 'private';

        let groupName = '';
        if (chatId.endsWith('@g.us')) {
            try {
                const meta = await sock.groupMetadata(chatId);
                groupName = meta.subject || '';
            } catch {}
        }

        const targets = [];
        if (mode === 'private' || mode === 'both') targets.push(ownerNumber);
        if ((mode === 'chat' || mode === 'both') && chatId !== ownerNumber) targets.push(chatId);
        if (targets.length === 0) targets.push(ownerNumber);

        let buffer;
        let actualType = type;

        if (useMessageDownload) {
            // Fallback: let Baileys figure out the media type and download internally
            try {
                buffer = await downloadMediaMessage(message, 'buffer', {});
                // Try to determine type from wrapper
                if (m.viewOnceMessage?.message?.videoMessage || m.viewOnceMessageV2?.message?.videoMessage) actualType = 'video';
                else actualType = 'image'; // Default to image
                console.log('[ANTIVIEWONCE] downloadMediaMessage succeeded, assumed type:', actualType);
            } catch (dlErr) {
                console.error('[ANTIVIEWONCE] downloadMediaMessage failed:', dlErr.message);
                return;
            }
        } else {
            try {
                buffer = await downloadBuffer(media, type);
                console.log('[ANTIVIEWONCE] Downloaded', type, 'buffer size:', buffer.length);
            } catch (dlErr) {
                // If direct download fails, try downloadMediaMessage as fallback
                console.log('[ANTIVIEWONCE] Direct download failed, trying downloadMediaMessage:', dlErr.message);
                try {
                    buffer = await downloadMediaMessage(message, 'buffer', {});
                    console.log('[ANTIVIEWONCE] downloadMediaMessage fallback succeeded');
                } catch (dl2Err) {
                    console.error('[ANTIVIEWONCE] All downloads failed:', dl2Err.message);
                    return;
                }
            }
        }

        if (!buffer || buffer.length === 0) {
            console.error('[ANTIVIEWONCE] Empty buffer — skipping');
            return;
        }

        const caption = `👁 *${botName} - VIEWONCE CAPTURED*\n\n` +
            `From: @${senderNumber}\n` +
            (groupName ? `Group: ${groupName}\n` : '') +
            `Type: ${actualType.toUpperCase()}`;

        for (const target of targets) {
            try {
                if (actualType === 'image') {
                    await sock.sendMessage(target, {
                        image: buffer,
                        caption,
                        mentions: [message.key.participant || message.key.remoteJid]
                    });
                } else if (actualType === 'video') {
                    await sock.sendMessage(target, {
                        video: buffer,
                        caption,
                        mentions: [message.key.participant || message.key.remoteJid]
                    });
                } else if (actualType === 'audio') {
                    await sock.sendMessage(target, {
                        audio: buffer,
                        mimetype: media?.mimetype || 'audio/mp4'
                    });
                } else {
                    // Unknown type — try image first
                    await sock.sendMessage(target, { image: buffer, caption });
                }
                console.log('[ANTIVIEWONCE] Sent to', target);
            } catch (sendErr) {
                console.error(`[ANTIVIEWONCE] Send to ${target} failed:`, sendErr.message);
            }
        }

    } catch (err) {
        console.error('[ANTIVIEWONCE] Error:', err.message);
    }
}

async function antiviewonceCommand(sock, chatId, message, args) {
    const botName = getBotName();
    const fake = createFakeContact(message);
    const prefix = getPrefix();
    const sub = (args || '').trim().toLowerCase();

    const ownerRaw = getOwnerConfig('antiviewonce');
    const ownerConf = normalizeOwnerConfig(ownerRaw);

    const sendReply = (text) => sock.sendMessage(chatId, { text }, { quoted: fake });

    if (!sub) {
        return sendReply(
            `*${botName} ANTIVIEWONCE*\n\n` +
            `Groups: ${ownerConf.gc.enabled ? 'ON' : 'OFF'} (${ownerConf.gc.mode})\n` +
            `PMs: ${ownerConf.pm.enabled ? 'ON' : 'OFF'} (${ownerConf.pm.mode})\n\n` +
            `*Commands:*\n` +
            `${prefix}antiviewonce on — Enable (all chats)\n` +
            `${prefix}antiviewonce off — Disable (all chats)\n` +
            `${prefix}antiviewonce private — Capture → your DM\n` +
            `${prefix}antiviewonce chat — Capture → same chat\n` +
            `${prefix}antiviewonce both — Capture → DM + same chat\n` +
            `${prefix}antiviewonce gc off — Disable groups only\n` +
            `${prefix}antiviewonce gc on — Enable groups only\n` +
            `${prefix}antiviewonce pm off — Disable PMs only\n` +
            `${prefix}antiviewonce pm on — Enable PMs only\n` +
            `${prefix}antiviewonce status — Show status`
        );
    }

    if (sub === 'status') {
        return sendReply(
            `*${botName} ANTIVIEWONCE STATUS*\n\n` +
            `Groups: ${ownerConf.gc.enabled ? 'ON' : 'OFF'} (${ownerConf.gc.mode})\n` +
            `PMs: ${ownerConf.pm.enabled ? 'ON' : 'OFF'} (${ownerConf.pm.mode})`
        );
    }

    const parts = sub.split(/\s+/);
    const scope = parts[0];
    const action = parts[1] || '';

    if (scope === 'gc' || scope === 'group' || scope === 'groups') {
        const toggle = parseToggleCommand(action);
        if (toggle === 'on') {
            ownerConf.gc.enabled = true;
            setOwnerConfig('antiviewonce', ownerConf);
            return sendReply(`*${botName}*\nAntiViewonce GROUPS: ON\nMode: ${ownerConf.gc.mode}`);
        } else if (toggle === 'off') {
            ownerConf.gc.enabled = false;
            setOwnerConfig('antiviewonce', ownerConf);
            return sendReply(`*${botName}*\nAntiViewonce GROUPS: OFF`);
        } else if (['private', 'prvt', 'priv'].includes(action)) {
            ownerConf.gc.enabled = true;
            ownerConf.gc.mode = 'private';
            setOwnerConfig('antiviewonce', ownerConf);
            return sendReply(`*${botName}*\nAntiViewonce GROUPS: PRIVATE`);
        } else if (['chat', 'cht'].includes(action)) {
            ownerConf.gc.enabled = true;
            ownerConf.gc.mode = 'chat';
            setOwnerConfig('antiviewonce', ownerConf);
            return sendReply(`*${botName}*\nAntiViewonce GROUPS: CHAT`);
        } else if (['both', 'all'].includes(action)) {
            ownerConf.gc.enabled = true;
            ownerConf.gc.mode = 'both';
            setOwnerConfig('antiviewonce', ownerConf);
            return sendReply(`*${botName}*\nAntiViewonce GROUPS: BOTH`);
        }
        return sendReply(`*${botName}*\nUsage: ${prefix}antiviewonce gc on/off/private/chat/both`);
    }

    if (scope === 'pm' || scope === 'dm' || scope === 'pms') {
        const toggle = parseToggleCommand(action);
        if (toggle === 'on') {
            ownerConf.pm.enabled = true;
            setOwnerConfig('antiviewonce', ownerConf);
            return sendReply(`*${botName}*\nAntiViewonce PMs: ON\nMode: ${ownerConf.pm.mode}`);
        } else if (toggle === 'off') {
            ownerConf.pm.enabled = false;
            setOwnerConfig('antiviewonce', ownerConf);
            return sendReply(`*${botName}*\nAntiViewonce PMs: OFF`);
        } else if (['private', 'prvt', 'priv'].includes(action)) {
            ownerConf.pm.enabled = true;
            ownerConf.pm.mode = 'private';
            setOwnerConfig('antiviewonce', ownerConf);
            return sendReply(`*${botName}*\nAntiViewonce PMs: PRIVATE`);
        } else if (['chat', 'cht'].includes(action)) {
            ownerConf.pm.enabled = true;
            ownerConf.pm.mode = 'chat';
            setOwnerConfig('antiviewonce', ownerConf);
            return sendReply(`*${botName}*\nAntiViewonce PMs: CHAT`);
        } else if (['both', 'all'].includes(action)) {
            ownerConf.pm.enabled = true;
            ownerConf.pm.mode = 'both';
            setOwnerConfig('antiviewonce', ownerConf);
            return sendReply(`*${botName}*\nAntiViewonce PMs: BOTH`);
        }
        return sendReply(`*${botName}*\nUsage: ${prefix}antiviewonce pm on/off/private/chat/both`);
    }

    const toggle = parseToggleCommand(scope);
    if (toggle === 'on') {
        ownerConf.gc.enabled = true;
        ownerConf.pm.enabled = true;
        setOwnerConfig('antiviewonce', ownerConf);
        return sendReply(`*${botName}*\nAntiViewonce ENABLED (Groups + PMs)\nMode: ${ownerConf.gc.mode}`);
    } else if (toggle === 'off') {
        ownerConf.gc.enabled = false;
        ownerConf.pm.enabled = false;
        setOwnerConfig('antiviewonce', ownerConf);
        return sendReply(`*${botName}*\nAntiViewonce DISABLED`);
    } else if (['private', 'prvt', 'priv'].includes(scope)) {
        ownerConf.gc.enabled = true;
        ownerConf.gc.mode = 'private';
        ownerConf.pm.enabled = true;
        ownerConf.pm.mode = 'private';
        setOwnerConfig('antiviewonce', ownerConf);
        return sendReply(`*${botName}*\nAntiViewonce PRIVATE (all chats) — Viewonces → your DM.`);
    } else if (['chat', 'cht'].includes(scope)) {
        ownerConf.gc.enabled = true;
        ownerConf.gc.mode = 'chat';
        ownerConf.pm.enabled = true;
        ownerConf.pm.mode = 'chat';
        setOwnerConfig('antiviewonce', ownerConf);
        return sendReply(`*${botName}*\nAntiViewonce CHAT (all chats) — Viewonces → same chat.`);
    } else if (['both', 'all'].includes(scope)) {
        ownerConf.gc.enabled = true;
        ownerConf.gc.mode = 'both';
        ownerConf.pm.enabled = true;
        ownerConf.pm.mode = 'both';
        setOwnerConfig('antiviewonce', ownerConf);
        return sendReply(`*${botName}*\nAntiViewonce BOTH (all chats) — Viewonces → DM + chat.`);
    }

    return sendReply(
        `*${botName}*\nInvalid! Use:\n` +
        `${prefix}antiviewonce on/off\n` +
        `${prefix}antiviewonce private/chat/both\n` +
        `${prefix}antiviewonce gc on/off\n` +
        `${prefix}antiviewonce pm on/off`
    );
}

module.exports = { handleAntiviewonce, antiviewonceCommand };
