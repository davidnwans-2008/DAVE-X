const axios = require('axios');
const { createFakeContact, getBotName } = require('../../davelib/fakeContact');
async function wormgptCommand(sock, chatId, message) {
    const fake = createFakeContact(message);
    
    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || '';
    
    const query = text.split(' ').slice(1).join(' ').trim();
    
    if (!query) {
        return sock.sendMessage(chatId, { 
            text: `*WormGPT - Uncensored AI*\n\nI am WormGPT — uncensored, fearless, and ready for anything. Ask me what you dare.\n\nExample: .wormgpt How to hack a website?` 
        }, { quoted: fake });
    }

    try {
        const apiUrl = `https://apiskeith.top/ai/wormgpt?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(apiUrl, { 
            timeout: 30000,
            headers: { 
                'user-agent': 'Mozilla/5.0',
                'accept': 'application/json'
            } 
        });

        if (!data || !data.status || !data.result) {
            throw new Error('Invalid API response');
        }

        const answer = data.result.trim();

        await sock.sendMessage(chatId, { text: `${answer}\n\n- DAVE X` }, { quoted: fake });

    } catch (error) {
        console.error("WormGPT Error:", error);

        let errorMessage = "Failed to get response from WormGPT.";

        if (error.response?.status === 404) {
            errorMessage += " API endpoint not found.";
        } else if (error.response?.status === 429) {
            errorMessage += " Rate limit exceeded.";
        } else if (error.message.includes("timeout")) {
            errorMessage += " Request timed out.";
        } else if (error.message.includes("ENOTFOUND")) {
            errorMessage += " Cannot connect to API server.";
        } else {
            errorMessage += " " + error.message;
        }

        await sock.sendMessage(chatId, { text: `*ERROR*\n${errorMessage}\n\n- DAVE X` }, { quoted: fake });
    }
}

module.exports = wormgptCommand;