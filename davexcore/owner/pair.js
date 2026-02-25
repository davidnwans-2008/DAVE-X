const PastebinAPI = require('pastebin-js');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { createFakeContact, getBotName } = require('../../davelib/fakeContact');
const db = require('../../Database/database');
const { makeid } = require('../../davelib/id');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require('@whiskeysockets/baileys');

const pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL');

function removeFile(filePath) {
    if (!fs.existsSync(filePath)) return false;
    fs.rmSync(filePath, { recursive: true, force: true });
}

async function isAuthorized(sock, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        if (message.key.fromMe) return true;
        return db.isSudo(senderId);
    } catch {
        return message.key.fromMe;
    }
}

async function pairCommand(sock, chatId, q, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();

        if (!await isAuthorized(sock, message)) {
            return sock.sendMessage(chatId, { 
                text: `*${botName}*\nOwner only command!` 
            }, { quoted: fake });
        }

        if (!q) {
            return sock.sendMessage(chatId, {
                text: `*${botName} PAIR*\n\n.pair 254712345678`
            }, { quoted: fake });
        }

        const phoneNumber = q.replace(/[^0-9]/g, '');

        if (phoneNumber.length < 10 || phoneNumber.length > 15) {
            return sock.sendMessage(chatId, { 
                text: `*${botName}*\nInvalid number!` 
            }, { quoted: fake });
        }

        await sock.sendMessage(chatId, { 
            text: `*${botName}*\nGenerating for +${phoneNumber}...` 
        }, { quoted: fake });

        const id = makeid(10);
        const tempDir = path.join(process.cwd(), 'temp', id);

        try {
            await fs.promises.mkdir(tempDir, { recursive: true });

            const { state, saveCreds } = await useMultiFileAuthState(tempDir);

            const pairSock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
                },
                version: [2, 3000, 1027934701],
                printQRInTerminal: false,
                logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
                browser: Browsers.macOS('Chrome')
            });

            if (!pairSock.authState.creds.registered) {
                await delay(1500);
                
                let code;
                try {
                    code = await pairSock.requestPairingCode(phoneNumber);
                } catch (pairErr) {
                    await delay(3000);
                    try {
                        code = await pairSock.requestPairingCode(phoneNumber);
                    } catch (retryErr) {
                        removeFile(tempDir);
                        return sock.sendMessage(chatId, {
                            text: `*${botName}*\nFailed to generate code.`
                        }, { quoted: fake });
                    }
                }
                
                const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;

                // Optional: Save to pastebin
                try {
                    await pastebin.createPaste({
                        text: `Pair code for ${phoneNumber}: ${formattedCode}`,
                        title: `Pair-${id}`,
                        format: 'text',
                        privacy: 1
                    });
                } catch (pasteErr) {
                    console.log('Pastebin error:', pasteErr.message);
                }

                await sock.sendMessage(chatId, {
                    text: `*${botName}*\nCode: ${formattedCode}\n\nEnter on target device.`
                }, { quoted: fake });

                pairSock.ev.on('creds.update', saveCreds);

                pairSock.ev.on('connection.update', async (update) => {
                    const { connection } = update;

                    if (connection === 'open') {
                        await delay(5000);

                        const credsPath = path.join(tempDir, 'creds.json');
                        
                        if (fs.existsSync(credsPath)) {
                            const data = fs.readFileSync(credsPath);
                            const b64data = Buffer.from(data).toString('base64');
                            const sessionId = `DAVE-X:~${b64data}`;

                            await pairSock.sendMessage(
                                pairSock.user.id,
                                { text: sessionId }
                            );

                            await sock.sendMessage(chatId, {
                                text: `*${botName}*\nSession generated!\n\n${sessionId}`
                            }, { quoted: fake });
                        }

                        await delay(100);
                        await pairSock.ws.close();
                        removeFile(tempDir);
                    }
                });
            }

        } catch (innerErr) {
            console.error('Pair error:', innerErr.message);
            removeFile(tempDir);
        }

    } catch (error) {
        console.error('Pair command error:', error.message);
    }
}

module.exports = pairCommand;