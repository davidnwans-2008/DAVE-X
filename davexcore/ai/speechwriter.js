const axios = require('axios');
const { createFakeContact, getBotName } = require('../../davelib/fakeContact');

async function speechwriterCommand(sock, chatId, message, args) {
    const fake = createFakeContact(message);
    const botName = getBotName();

    try {
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const text = message.message?.conversation ||
                     message.message?.extendedTextMessage?.text ||
                     message.message?.imageMessage?.caption || '';

        const query = text.split(' ').slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: `✦ *${botName}* | Speechwriter\n\nUse: .speechwriter <topic>\nExample: .speechwriter motivational speech about teamwork`
            }, { quoted: fake });
        }

        await sock.sendPresenceUpdate('composing', chatId);

        const prompt = `Write a compelling, well-structured speech about: ${query}. Include an introduction, main points, and a strong conclusion.`;
        const apiUrl = `https://api.siputzx.my.id/api/ai/meta-llama?content=${encodeURIComponent(prompt)}`;
        const response = await axios.get(apiUrl, { timeout: 30000 });

        const result = response.data?.data || response.data?.result || response.data;
        if (!result || typeof result !== 'string') throw new Error('No response from API');

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        await sock.sendMessage(chatId, {
            text: `✦ *${botName}* | Speechwriter\n\n📝 *Topic:* ${query}\n\n${result.trim()}`
        }, { quoted: fake });

    } catch (error) {
        console.error('Speechwriter error:', error.message);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        await sock.sendMessage(chatId, {
            text: `✦ *${botName}* | Failed to generate speech. Please try again.`
        }, { quoted: fake });
    }
}

module.exports = speechwriterCommand;
