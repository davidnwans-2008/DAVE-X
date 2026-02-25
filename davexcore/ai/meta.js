const axios = require('axios');
const { createFakeContact, getBotName } = require('../../davelib/fakeContact');

async function metaaiCommand(sock, chatId, message) {
    const fake = createFakeContact(message);
    const botName = getBotName();
    
    try {
        // Send reaction
        await sock.sendMessage(chatId, {
            react: { text: '⏳', key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: `✦ *${botName}* Meta AI\n\nUse: .metaai <question>\nExample: .metaai what is AI`
            }, { quoted: fake });
        }

        if (query.length > 1000) {
            return await sock.sendMessage(chatId, {
                text: `✦ *${botName}*\nQuestion too long (max 1000 chars)`
            }, { quoted: fake });
        }

        // Update presence to "typing"
        await sock.sendPresenceUpdate('composing', chatId);

        // Fetch AI response
        const apiUrl = `https://apis.davidcyriltech.my.id/ai/metaai?text=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl, { timeout: 30000 });
        const apiData = response.data;

        if (!apiData.success || !apiData.response) {
            throw new Error("API failed to generate response!");
        }

        // Send success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Format and send response
        const aiResponse = apiData.response.trim();
        
        await sock.sendMessage(chatId, {
            text: `✦ *${botName}* - am know invisible 🔥

✦ Question: ${query}

✦ ${aiResponse}`
        }, { quoted: fake });

    } catch (error) {
        console.error("Meta AI command error:", error);
        
        // Send error reaction
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        let errorMessage = "✦ Failed to generate response";
        
        if (error.response?.status === 404) {
            errorMessage = '✦ Service unavailable';
        } else if (error.message.includes('timeout') || error.code === 'ECONNABORTED') {
            errorMessage = '✦ Request timeout';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = '✦ Network error';
        }
            
        await sock.sendMessage(chatId, {
            text: errorMessage
        }, { quoted: fake });
    }
}

module.exports = metaaiCommand;