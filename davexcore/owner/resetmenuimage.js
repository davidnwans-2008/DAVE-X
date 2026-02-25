const { createFakeContact, getBotName } = require('../../davelib/fakeContact');
const { setMenuImage } = require('../../davelib/botConfig');

async function resetMenuImageCommand(sock, chatId, message) {
    const fakeContact = createFakeContact(message);
    const botName = getBotName();
    
    try {
        setMenuImage('');
        await sock.sendMessage(chatId, { text: `*${botName}*\nMenu image has been reset to default.` }, { quoted: fakeContact });
    } catch (err) {
        await sock.sendMessage(chatId, { text: `*${botName}*\nFailed to reset: ${err.message}` }, { quoted: fakeContact });
    }
}

module.exports = resetMenuImageCommand;
