const { createFakeContact, getBotName } = require('../../davelib/fakeContact');

async function removeProfilePicCommand(sock, chatId, message) {
    const fake = createFakeContact(message);
    const botName = getBotName();
    try {
        if (!message.key.fromMe) {
            return sock.sendMessage(chatId, {
                text: `✦ *${botName}* | Owner only command.`
            }, { quoted: fake });
        }

        await sock.removeProfilePicture(sock.user.id);

        await sock.sendMessage(chatId, {
            text: `✦ *${botName}* | ✅ Profile picture removed.`
        }, { quoted: fake });

    } catch (error) {
        console.error('removeProfilePicCommand error:', error.message);
        await sock.sendMessage(chatId, {
            text: `✦ *${botName}* | ❌ Failed to remove profile picture: ${error.message}`
        }, { quoted: fake });
    }
}

async function setProfilePicPrivacyCommand(sock, chatId, message, mode) {
    const fake = createFakeContact(message);
    const botName = getBotName();
    try {
        if (!message.key.fromMe) {
            return sock.sendMessage(chatId, {
                text: `✦ *${botName}* | Owner only command.`
            }, { quoted: fake });
        }

        // mode: 'all' = everyone, 'none' = nobody, 'contacts' = contacts only
        await sock.updateProfilePicturePrivacy(mode);

        const labels = { all: 'Everyone', none: 'Nobody', contacts: 'Contacts only' };
        await sock.sendMessage(chatId, {
            text: `✦ *${botName}* | ✅ Profile picture visibility set to *${labels[mode] || mode}*.`
        }, { quoted: fake });

    } catch (error) {
        console.error('setProfilePicPrivacyCommand error:', error.message);

        let hint = '';
        if (error.message?.includes('not-found') || error.message?.includes('conflict')) {
            hint = '\n\n_Note: Try setting this from WhatsApp Settings > Privacy > Profile Photo._';
        }
        await sock.sendMessage(chatId, {
            text: `✦ *${botName}* | ❌ Failed to update privacy: ${error.message}${hint}`
        }, { quoted: fake });
    }
}

module.exports = {
    removeProfilePicCommand,
    setProfilePicPrivacyCommand
};
