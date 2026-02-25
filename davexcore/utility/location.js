    const axios = require('axios');
const { createFakeContact, getBotName } = require('../../davelib/fakeContact');

async function locationCommand(sock, chatId, message) {
    const fake = createFakeContact(message);
    const botName = getBotName();
    
    try {
        // Send initial reaction
        await sock.sendMessage(chatId, {
            react: { text: '⏳', key: message.key }
        });

        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || 
                     message.message?.imageMessage?.caption || 
                     '';
        
        if (!text.includes(' ')) {
            return await sock.sendMessage(chatId, {
                text: `✦ *${botName}* Location\n\nUse: .location <place>\nExample: .location Nairobi, Kenya`
            }, { quoted: fake });
        }

        const parts = text.split(' ');
        const locationQuery = parts.slice(1).join(' ').trim();

        if (!locationQuery) {
            return await sock.sendMessage(chatId, {
                text: `✦ *${botName}*\nProvide a location`
            }, { quoted: fake });
        }

        if (locationQuery.length > 100) {
            return await sock.sendMessage(chatId, {
                text: `✦ *${botName}*\nLocation name too long (max 100 chars)`
            }, { quoted: fake });
        }

        // Update presence to "recording" (searching)
        await sock.sendPresenceUpdate('recording', chatId);

        // Call API to resolve coordinates
        const apiUrl = `https://apiskeith.top/tools/location?q=${encodeURIComponent(locationQuery)}`;
        const response = await axios.get(apiUrl, { timeout: 60000 });
        const apiData = response.data;

        if (!apiData?.status || !apiData?.result?.results?.length) {
            throw new Error(`Could not find location for: ${locationQuery}`);
        }

        const locationData = apiData.result.results[0];
        const { lat, lng } = locationData.geometry;
        const formattedName = locationData.formatted || locationQuery;

        // Send success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Send the location message
        await sock.sendMessage(chatId, {
            location: {
                degreesLatitude: lat,
                degreesLongitude: lng,
                name: formattedName,
                address: formattedName
            }
        }, { quoted: fake });

        // Send final reaction
        await sock.sendMessage(chatId, {
            react: { text: '📍', key: message.key }
        });

    } catch (error) {
        console.error("Location command error:", error);
        
        // Send error reaction
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        let errorMessage = "✦ Location not found";
        
        if (error.response?.status === 404) {
            errorMessage = '✦ Service unavailable';
        } else if (error.message.includes('timeout') || error.code === 'ECONNABORTED') {
            errorMessage = '✦ Request timeout';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = '✦ Network error';
        } else if (error.response?.status === 429) {
            errorMessage = '✦ Too many requests';
        } else if (error.response?.status >= 500) {
            errorMessage = '✦ Server error';
        } else if (error.message.includes('Could not find location')) {
            errorMessage = `✦ Could not find: ${locationQuery}`;
        }
            
        await sock.sendMessage(chatId, {
            text: errorMessage
        }, { quoted: fake });
    }
}

module.exports = locationCommand;