const { createFakeContact, getBotName } = require('../../davelib/fakeContact');
const axios = require('axios');

async function ipLookupCommand(sock, chatId, message, args) {
    const fake = createFakeContact(message);
    const botName = getBotName();
    const ip = args[0]?.trim();
    
    if (!ip) {
        return sock.sendMessage(chatId, { 
            text: `✦ *${botName}* IP Lookup\n\nUse: .iplookup <ip>\nExample: .iplookup 8.8.8.8` 
        }, { quoted: fake });
    }
    
    await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });
    
    try {
        const res = await axios.get(`http://ip-api.com/json/${ip}`, { timeout: 10000 });
        const d = res.data;
        if (d.status === 'success') {
            const text = `✦ *${botName}* IP Lookup\n\nIP: ${d.query}\nCountry: ${d.country}\nRegion: ${d.regionName}\nCity: ${d.city}\nZIP: ${d.zip}\nISP: ${d.isp}\nOrg: ${d.org}\nTimezone: ${d.timezone}\nLat: ${d.lat}\nLon: ${d.lon}`;
            await sock.sendMessage(chatId, { text }, { quoted: fake });
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        } else {
            await sock.sendMessage(chatId, { 
                text: `✦ *${botName}*\nInvalid IP or lookup failed` 
            }, { quoted: fake });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        }
    } catch (err) {
        await sock.sendMessage(chatId, { 
            text: `✦ *${botName}*\nError: ${err.message}` 
        }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

async function whoIsCommand(sock, chatId, message, args) {
    const fake = createFakeContact(message);
    const botName = getBotName();
    const domain = args[0]?.trim();
    
    if (!domain) {
        return sock.sendMessage(chatId, { 
            text: `✦ *${botName}* WHOIS\n\nUse: .whois <domain>\nExample: .whois google.com` 
        }, { quoted: fake });
    }
    
    await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });
    
    try {
        const res = await axios.get(`https://bk9.fun/tools/whois?q=${encodeURIComponent(domain)}`, { timeout: 15000 });
        const result = res.data?.BK9 || res.data?.result;
        if (result) {
            const text = typeof result === 'object' 
                ? `✦ *${botName}* WHOIS: ${domain}\n\n${JSON.stringify(result, null, 2).substring(0, 2000)}` 
                : `✦ *${botName}* WHOIS: ${domain}\n\n${String(result).substring(0, 2000)}`;
            await sock.sendMessage(chatId, { text }, { quoted: fake });
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        } else {
            await sock.sendMessage(chatId, { 
                text: `✦ *${botName}*\nNo WHOIS data found for ${domain}` 
            }, { quoted: fake });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        }
    } catch (err) {
        await sock.sendMessage(chatId, { 
            text: `✦ *${botName}*\nError: ${err.message}` 
        }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

async function reverseipCommand(sock, chatId, message, args) {
    const fake = createFakeContact(message);
    const botName = getBotName();
    const ip = args[0]?.trim();
    
    if (!ip) {
        return sock.sendMessage(chatId, { 
            text: `✦ *${botName}* Reverse IP\n\nUse: .reverseip <ip>\nExample: .reverseip 8.8.8.8` 
        }, { quoted: fake });
    }
    
    await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });
    
    try {
        const res = await axios.get(`https://api.hackertarget.com/reverseiplookup/?q=${encodeURIComponent(ip)}`, { timeout: 15000 });
        if (res.data) {
            await sock.sendMessage(chatId, { 
                text: `✦ *${botName}* Reverse IP: ${ip}\n\n${String(res.data).substring(0, 2000)}` 
            }, { quoted: fake });
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        } else {
            await sock.sendMessage(chatId, { 
                text: `✦ *${botName}*\nNo data found for ${ip}` 
            }, { quoted: fake });
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        }
    } catch (err) {
        await sock.sendMessage(chatId, { 
            text: `✦ *${botName}*\nError: ${err.message}` 
        }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = { ipLookupCommand, whoIsCommand, reverseipCommand };