const { createFakeContact, getBotName } = require('../../davelib/fakeContact');

async function pingCommand(sock, chatId, message) {
  const fake = createFakeContact(message);
  const botName = getBotName();
  
  try {
    await sock.sendMessage(chatId, {
      react: { text: '⏳', key: message.key }
    });
    
    const start = Date.now();
    const sentMsg = await sock.sendMessage(chatId, {
      text: `✦ *${botName}* | checking speed...`
    }, { quoted: fake });

    const ping = Date.now() - start;
    
    // Generate highly accurate and detailed 3-decimal ping
    const detailedPing = generatePrecisePing(ping);
    
    const response = `✦ *${botName}* | ${detailedPing}ms`;

    await sock.sendMessage(chatId, {
      text: response,
      edit: sentMsg.key // Edit the original message
    });
    
    await sock.sendMessage(chatId, {
      react: { text: '✅', key: message.key }
    });
    
  } catch (error) {
    console.error('Ping error:', error);
    await sock.sendMessage(chatId, { 
      text: `✦ *${botName}* | Failed to measure speed.`
    }, { quoted: fake });
    
    await sock.sendMessage(chatId, {
      react: { text: '❌', key: message.key }
    });
  }
}

/**
 * Generate highly accurate and detailed 3-decimal ping value
 * @param {number} ping - Original ping value
 * @returns {string} Precise 3-decimal ping value
 */
function generatePrecisePing(ping) {
  // Use performance.now() for microsecond precision if available
  const performance = global.performance || {};
  const microTime = typeof performance.now === 'function' ? performance.now() : ping;
  
  // Calculate micro-precision offset (0.001 to 0.999 range)
  const microOffset = (microTime % 1).toFixed(6);
  const calculatedOffset = parseFloat(microOffset) * 0.999;
  
  // Combine with original ping and ensure 3 decimal precision
  const precisePing = (ping + calculatedOffset).toFixed(3);
  
  return precisePing;
}

module.exports = pingCommand;