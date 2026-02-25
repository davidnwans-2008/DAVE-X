const { getOwnerConfig, getGroupConfig } = require('../../Database/settingsStore');
const db = require('../../Database/database');
const { createFakeContact, getBotName } = require('../../davelib/fakeContact');

async function isAuthorized(sock, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        if (message.key.fromMe) return true;
        return db.isSudo(senderId);
    } catch {
        return message.key.fromMe;
    }
}

async function settingsCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();
        
        if (!await isAuthorized(sock, message)) {
            await sock.sendMessage(chatId, { text: `*${botName}*\nOwner only command!` }, { quoted: fake });
            return;
        }

        const isGroup = chatId.endsWith('@g.us');

        // Get all configurations
        const autoStatus = getOwnerConfig('autostatus') || { enabled: false };
        const autoread = getOwnerConfig('autoread') || { mode: 'off' };
        const autotyping = getOwnerConfig('autotyping') || { enabled: false };
        const autorecording = getOwnerConfig('autorecording') || { enabled: false };
        const pmblocker = getOwnerConfig('pmblocker') || { enabled: false };
        const anticall = getOwnerConfig('anticall') || { enabled: false };
        const antiedit = getOwnerConfig('antiedit') || { enabled: false };
        const antidelete = getOwnerConfig('antidelete') || { enabled: false };
        const autoReaction = getOwnerConfig('autoReaction') || { enabled: false };
        const prefix = getOwnerConfig('prefix') || '.';

        // Helper function to format status
        const formatStatus = (enabled, extra = '') => {
            return enabled ? `✓ ON ${extra}` : `✗ OFF`;
        };

        // Build message
        let messageText = `┌─ ${botName} SETTINGS ─┐\n\n`;
        
        messageText += `├─ BASIC ────────────┤\n`;
        messageText += `│ Prefix    : ${prefix === 'none' ? 'None' : `"${prefix}"`}\n`;
        messageText += `│ Auto Status : ${formatStatus(autoStatus.enabled)}\n`;
        messageText += `│ Autoread    : ${autoread.mode !== 'off' ? autoread.mode.toUpperCase() : 'OFF'}\n`;
        messageText += `│ Autotyping  : ${formatStatus(autotyping.enabled)}\n`;
        messageText += `│ Autorecording : ${formatStatus(autorecording.enabled)}\n\n`;

        messageText += `├─ PRIVACY ───────────┤\n`;
        messageText += `│ PM Blocker  : ${formatStatus(pmblocker.enabled)}\n`;
        messageText += `│ Anticall    : ${anticall.enabled ? `✓ ON (${anticall.mode || 'block'})` : '✗ OFF'}\n`;
        messageText += `│ Antiedit    : ${formatStatus(antiedit.enabled)}\n`;
        messageText += `│ Antidelete  : ${antidelete.enabled ? `✓ ON (${antidelete.mode || 'private'})` : '✗ OFF'}\n`;
        messageText += `│ Auto Reaction : ${formatStatus(autoReaction.enabled)}\n`;
        
        if (isGroup) {
            messageText += `\n├─ GROUP ────────────┤\n`;
            
            const antilink = getGroupConfig(chatId, 'antilink') || { enabled: false };
            const antibadword = getGroupConfig(chatId, 'antibadword') || { enabled: false };
            const welcome = getGroupConfig(chatId, 'welcome') || { enabled: false };
            const goodbye = getGroupConfig(chatId, 'goodbye') || { enabled: false };
            const chatbot = getGroupConfig(chatId, 'chatbot') || false;
            const antitag = getGroupConfig(chatId, 'antitag') || { enabled: false };
            const antimention = getGroupConfig(chatId, 'antimention') || { enabled: false };
            const antichart = getGroupConfig(chatId, 'antichart') || { enabled: false };
            const antikick = getGroupConfig(chatId, 'antikick') || { enabled: false };
            const groupAntiedit = getGroupConfig(chatId, 'antiedit') || { enabled: false };
            const groupAntidelete = getGroupConfig(chatId, 'antidelete') || { enabled: false };

            messageText += `│ Antilink     : ${antilink.enabled ? `✓ ON (${antilink.action || 'delete'})` : '✗ OFF'}\n`;
            messageText += `│ Antibadword  : ${antibadword.enabled ? `✓ ON (${antibadword.action || 'delete'})` : '✗ OFF'}\n`;
            messageText += `│ Welcome      : ${formatStatus(welcome.enabled)}\n`;
            messageText += `│ Goodbye      : ${formatStatus(goodbye.enabled)}\n`;
            messageText += `│ Chatbot      : ${chatbot ? '✓ ON' : '✗ OFF'}\n`;
            messageText += `│ Antitag      : ${formatStatus(antitag.enabled)}\n`;
            messageText += `│ Antimention  : ${formatStatus(antimention.enabled)}\n`;
            messageText += `│ Antichart    : ${antichart.enabled ? `✓ ON (${antichart.action || 'delete'})` : '✗ OFF'}\n`;
            messageText += `│ Antikick     : ${formatStatus(antikick.enabled)}\n`;
            messageText += `│ Antiedit     : ${formatStatus(groupAntiedit.enabled)}\n`;
            messageText += `│ Antidelete   : ${formatStatus(groupAntidelete.enabled)}\n`;
        }

        messageText += `\n└────────────────────┘`;

        await sock.sendMessage(chatId, { text: messageText }, { quoted: fake });
    } catch (error) {
        console.error('Error in settings command:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

module.exports = settingsCommand;