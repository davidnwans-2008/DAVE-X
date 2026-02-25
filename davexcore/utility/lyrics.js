const axios = require('axios');
const { createFakeContact, getBotName } = require('../../davelib/fakeContact');

async function lyricsCommand(sock, chatId, songTitle, message) {
    const fake = createFakeContact(message);
    const botName = getBotName();
    
    if (!songTitle) {
        await sock.sendMessage(chatId, { 
            text: `✦ *${botName}* Lyrics\n\nUse: .lyrics <song name>\nExample: .lyrics Never Gonna Give You Up`
        }, { quoted: fake });
        return;
    }

    try {
        await sock.sendMessage(chatId, {
            react: { text: '⏳', key: message.key }
        });
        
        const res = await axios.get(`https://apiskeith.top/search/lyrics2?query=${encodeURIComponent(songTitle)}`);
        const data = res.data;

        if (!data.status || !data.result) {
            await sock.sendMessage(chatId, { 
                text: `✦ *${botName}*\nLyrics not found` 
            }, { quoted: fake });
            
            await sock.sendMessage(chatId, {
                react: { text: '❌', key: message.key }
            });
            return;
        }

        await sock.sendMessage(chatId, { 
            text: `✦ *${botName}* - am know invisible 🔥\n\n${data.result}` 
        }, { quoted: fake });
        
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

    } catch (error) {
        console.error('Error in lyrics command:', error);
        await sock.sendMessage(chatId, { 
            text: `✦ *${botName}*\nFailed to fetch lyrics`
        }, { quoted: fake });
        
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });
    }
}

module.exports = { lyricsCommand };