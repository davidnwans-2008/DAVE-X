const { createFakeContact, getBotName } = require('../../davelib/fakeContact');

const morningMessages = [
    "Rise and shine sleepyhead! ☀️",
    "Your daily dose of motivation has arrived!",
    "Wakey wakey! It's time to make money 💸",
    "Another day, another opportunity to be awesome!",
    "The early bird gets the worm... or data bundles! 📶",
    "Morning! Have you had your coffee yet? ☕",
    "Let's conquer this day like it owes us money! 💪",
    "Good morning! Don't forget to smile today 😊"
];

const afternoonMessages = [
    "Still surviving? Good job! 👏",
    "Afternoon already? Time flies when you're having fun!",
    "Hope you've achieved something today... or at least tried!",
    "Lunch time? Don't forget to eat! 🍕",
    "The afternoon slump is real. Stay strong!",
    "You're halfway to bedtime. You got this!",
    "Afternoon vibes: Chill but productive 😎"
];

const eveningMessages = [
    "Sun is going down. Time to wind down! 🌆",
    "Evening! Put your feet up, you deserve it!",
    "The day is almost over. Hope it treated you well!",
    "Evening time = snack time! 🍿",
    "Time to reflect on all the things you procrastinated on today! 😅",
    "Good evening! Netflix and chill?",
    "The night is young... but so are you! Enjoy!",
    "Evening: The official time to overthink every conversation you had today."
];

const nightMessages = [
    "Past your bedtime? Go to sleep! 😴",
    "Night owl alert! 🦉",
    "Shouldn't you be sleeping right now?",
    "The night is for dreaming. Close your eyes!",
    "Don't stay up too late scrolling!",
    "Night night! Don't let the bed bugs bite!",
    "Sleep is important. Go get some!",
    "Tomorrow's problems need you well-rested!"
];

function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getTimeBasedGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 17) return "Good Afternoon";
    if (hour >= 17 && hour < 21) return "Good Evening";
    return "Good Night";
}

async function goodmorningCommand(sock, chatId, message) {
    const fakeContact = createFakeContact(message);
    const pushName = message.pushName || 'Friend';
    const botName = getBotName();
    try {
        const msg = randomPick(morningMessages);
        await sock.sendMessage(chatId, { 
            text: `✦ Good Morning @${pushName}!\n\n${msg}`,
            mentions: [message.key.participant || message.key.remoteJid]
        }, { quoted: fakeContact });
    } catch (error) {
        console.error('Error in goodmorning command:', error);
        await sock.sendMessage(chatId, { 
            text: `✦ Good Morning ${pushName}! Have a great day!` 
        }, { quoted: fakeContact });
    }
}

async function goodafternoonCommand(sock, chatId, message) {
    const fakeContact = createFakeContact(message);
    const pushName = message.pushName || 'Friend';
    try {
        const msg = randomPick(afternoonMessages);
        await sock.sendMessage(chatId, { 
            text: `✦ Good Afternoon @${pushName}!\n\n${msg}`,
            mentions: [message.key.participant || message.key.remoteJid]
        }, { quoted: fakeContact });
    } catch (error) {
        console.error('Error in goodafternoon command:', error);
        await sock.sendMessage(chatId, { 
            text: `✦ Good Afternoon ${pushName}! Hope your day is going well!` 
        }, { quoted: fakeContact });
    }
}

async function goodeveningCommand(sock, chatId, message) {
    const fakeContact = createFakeContact(message);
    const pushName = message.pushName || 'Friend';
    try {
        const msg = randomPick(eveningMessages);
        await sock.sendMessage(chatId, { 
            text: `✦ Good Evening @${pushName}!\n\n${msg}`,
            mentions: [message.key.participant || message.key.remoteJid]
        }, { quoted: fakeContact });
    } catch (error) {
        console.error('Error in goodevening command:', error);
        await sock.sendMessage(chatId, { 
            text: `✦ Good Evening ${pushName}! Time to relax!` 
        }, { quoted: fakeContact });
    }
}

async function goodnightCommand(sock, chatId, message) {
    const fakeContact = createFakeContact(message);
    const pushName = message.pushName || 'Friend';
    try {
        const msg = randomPick(nightMessages);
        await sock.sendMessage(chatId, { 
            text: `✦ Good Night @${pushName}!\n\n${msg}`,
            mentions: [message.key.participant || message.key.remoteJid]
        }, { quoted: fakeContact });
    } catch (error) {
        console.error('Error in goodnight command:', error);
        await sock.sendMessage(chatId, { 
            text: `✦ Good Night ${pushName}! Sleep well!` 
        }, { quoted: fakeContact });
    }
}

async function greetCommand(sock, chatId, message) {
    const fakeContact = createFakeContact(message);
    const pushName = message.pushName || 'Friend';
    const greeting = getTimeBasedGreeting();
    
    const allMessages = [...morningMessages, ...afternoonMessages, ...eveningMessages, ...nightMessages];
    const msg = randomPick(allMessages);
    
    try {
        await sock.sendMessage(chatId, { 
            text: `✦ ${greeting} @${pushName}!\n\n${msg}`,
            mentions: [message.key.participant || message.key.remoteJid]
        }, { quoted: fakeContact });
    } catch (error) {
        console.error('Error in greet command:', error);
        await sock.sendMessage(chatId, { 
            text: `✦ ${greeting} ${pushName}!` 
        }, { quoted: fakeContact });
    }
}

module.exports = { 
    goodmorningCommand, 
    goodafternoonCommand, 
    goodeveningCommand,
    goodnightCommand,
    greetCommand
};