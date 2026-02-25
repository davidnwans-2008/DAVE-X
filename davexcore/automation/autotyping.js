const { getOwnerConfig, setOwnerConfig, parseToggleCommand } = require('../../Database/settingsStore');
const db = require('../../Database/database');
const { createFakeContact, getBotName } = require('../../davelib/fakeContact');

const typingIntervals = new Map();

async function isAuthorized(sock, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        if (message.key.fromMe) return true;
        return db.isSudo(senderId);
    } catch {
        return message.key.fromMe;
    }
}

async function autotypingCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();

        if (!await isAuthorized(sock, message)) {
            await sock.sendMessage(chatId, { 
                text: `✦ Owner only command` 
            }, { quoted: fake });
            return;
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(/\s+/).slice(1);
        const action = args[0]?.toLowerCase();
        const action2 = args[1]?.toLowerCase();

        const config = getOwnerConfig('autotyping') || { enabled: false, duration: 3000, pm: true, group: true };

        if (!action) {
            const helpText = `✦ *AUTOTYPING*
    
  Status: ${config.enabled ? 'ON' : 'OFF'}
  PM: ${config.pm ? 'ON' : 'OFF'}
  Group: ${config.group ? 'ON' : 'OFF'}

✦ *Commands:*
  › on
  › off
  › pm
  › group
  › both
  › pm on/off
  › group on/off
  › both on/off`;
            await sock.sendMessage(chatId, { text: helpText }, { quoted: fake });
            return;
        }

        let newConfig = { ...config };
        let responseText = '';

        const toggle = parseToggleCommand(action);

        if (toggle === 'on') {
            newConfig.enabled = true;
            newConfig.pm = true;
            newConfig.group = true;
            responseText = `✦ Autotyping ENABLED for both PMs & Groups`;
        } else if (toggle === 'off') {
            newConfig.enabled = false;
            stopAllTypingIntervals();
            responseText = `✦ Autotyping DISABLED`;
        } else if (action === 'pm') {
            const toggle2 = action2 ? parseToggleCommand(action2) : null;
            if (toggle2 === 'off') {
                newConfig.pm = false;
                if (!newConfig.group) newConfig.enabled = false;
                responseText = `✦ Autotyping PM mode DISABLED\n  Group: ${newConfig.group ? 'ON' : 'OFF'}`;
            } else {
                newConfig.pm = true;
                newConfig.group = false;
                newConfig.enabled = true;
                responseText = `✦ Autotyping enabled for PMs only`;
                if (toggle2 === 'on') {
                    newConfig.group = config.group;
                    responseText = `✦ Autotyping PM mode ENABLED\n  Group: ${newConfig.group ? 'ON' : 'OFF'}`;
                }
            }
        } else if (action === 'group') {
            const toggle2 = action2 ? parseToggleCommand(action2) : null;
            if (toggle2 === 'off') {
                newConfig.group = false;
                if (!newConfig.pm) newConfig.enabled = false;
                responseText = `✦ Autotyping Group mode DISABLED\n  PM: ${newConfig.pm ? 'ON' : 'OFF'}`;
            } else {
                newConfig.group = true;
                newConfig.pm = false;
                newConfig.enabled = true;
                responseText = `✦ Autotyping enabled for Groups only`;
                if (toggle2 === 'on') {
                    newConfig.pm = config.pm;
                    responseText = `✦ Autotyping Group mode ENABLED\n  PM: ${newConfig.pm ? 'ON' : 'OFF'}`;
                }
            }
        } else if (action === 'both') {
            const toggle2 = action2 ? parseToggleCommand(action2) : null;
            if (toggle2 === 'off') {
                newConfig.enabled = false;
                newConfig.pm = false;
                newConfig.group = false;
                stopAllTypingIntervals();
                responseText = `✦ Autotyping DISABLED for both PMs & Groups`;
            } else {
                newConfig.pm = true;
                newConfig.group = true;
                newConfig.enabled = true;
                responseText = `✦ Autotyping enabled for both PMs & Groups`;
            }
        } else {
            responseText = `✦ Invalid! Use: on, off, pm, group, both\n  Or: pm on/off, group on/off, both on/off`;
        }

        if (responseText && !responseText.includes('Invalid')) {
            if (!newConfig.pm && !newConfig.group) {
                newConfig.enabled = false;
                stopAllTypingIntervals();
            }
            setOwnerConfig('autotyping', newConfig);
        }

        await sock.sendMessage(chatId, { text: responseText }, { quoted: fake });
    } catch (error) {
        console.error('Error in autotyping command:', error.message, 'Line:', error.stack?.split('\n')[1]);
    }
}

function isAutotypingEnabled() {
    const config = getOwnerConfig('autotyping');
    return config?.enabled || false;
}

function stopAllTypingIntervals() {
    for (const [key, interval] of typingIntervals.entries()) {
        clearInterval(interval);
        typingIntervals.delete(key);
    }
}

async function handleAutotypingForMessage(sock, chatId) {
    try {
        const config = getOwnerConfig('autotyping');
        if (!config?.enabled) return;
        
        const isGroup = chatId.endsWith('@g.us');
        if (isGroup && !config.group) return;
        if (!isGroup && !config.pm) return;
        
        if (typingIntervals.has(chatId)) {
            clearInterval(typingIntervals.get(chatId));
        }

        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);

        const interval = setInterval(async () => {
            try {
                const currentConfig = getOwnerConfig('autotyping');
                if (!currentConfig?.enabled) {
                    clearInterval(interval);
                    typingIntervals.delete(chatId);
                    return;
                }
                await sock.sendPresenceUpdate('composing', chatId);
            } catch (e) {
                clearInterval(interval);
                typingIntervals.delete(chatId);
            }
        }, 4000);

        typingIntervals.set(chatId, interval);

        setTimeout(() => {
            if (typingIntervals.has(chatId)) {
                clearInterval(typingIntervals.get(chatId));
                typingIntervals.delete(chatId);
                try { sock.sendPresenceUpdate('paused', chatId); } catch(e) {}
            }
        }, 30000);
    } catch (error) {
        console.error('Autotyping error:', error.message);
    }
}

module.exports = {
    autotypingCommand,
    isAutotypingEnabled,
    handleAutotypingForMessage,
    stopAllTypingIntervals
};