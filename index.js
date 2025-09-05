require('dotenv/config');

const {Client}=require('discord.js');
const {GoogleGenAI}=require('@google/genai');

const client = new Client ({
    intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent']

});

client.on('clientReady', ()=> {
    console.log('the bot is online');
});

const IGNORE_PREFIX="!";
const CHANNELS=['1412728141339688982']

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_AI_KEY,
});

// Personality instruction (easy to swap later)
let BOT_PERSONALITY = 'You are a friendly chatbot.';

let conversation = [];

//Actions for when a message is sent
client.on('messageCreate', async (message)=> {
    if (message.author.bot)return;
    if (message.content.startsWith(IGNORE_PREFIX))return;
    if (!CHANNELS.includes(message.channelId) && !message.mentions.users.has(client.user.id))return; //Check if message sent in listed channels and if the pings bot.

    // ✅ Handle commands before calling Gemini
    if (message.content.startsWith("/be ")) {
    BOT_PERSONALITY = `You are now ${message.content.replace("/be ", "").trim()}. Stay fully in character.`;
    conversation = []; // wipe history so new personality takes over
    await message.reply(`Personality switched! ${BOT_PERSONALITY}`);
    return;
    };

    await message.channel.sendTyping();

    //Every 5 seconds send 'typing...' to channel
    const sendTypingInterval = setInterval(() => {
        message.channel.sendTyping();
    }, 5000); 


    if (message.content === "/wipe") {
        clearInterval(sendTypingInterval);
        conversation = [];
        message.reply("Memory has been wiped 🧹");
        return;
    }

    // Grab last 10 messages
    let prevMessages = await message.channel.messages.fetch({ limit: 10 });
    prevMessages.reverse();

    prevMessages.forEach((msg) => {
    if (msg.author.bot && msg.author.id !== client.user.id) return;
    if (msg.content.startsWith(IGNORE_PREFIX)) return;

    if (msg.author.id === client.user.id) {
        conversation.push({
        role: "model",
        parts: [{ text: msg.content }],
        });
    } else {
        conversation.push({
        role: "user",
        parts: [{ text: msg.content }],
        });
    }
    return;
    });
    
    const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: conversation,
    systemInstruction: {
    role: "system",
    parts: [{ text: BOT_PERSONALITY }],
        },
    
    }).catch((error)=> console.error('Gemini Error:\n', error));

    clearInterval(sendTypingInterval);

    if(!response){
        message.reply("I'm having trouble with the Gemini API. Try again in a moment.");
        return;
    }


    const responsMessage=response.text;
    const chunkSizeLimit=2000;

    for (let i=0; i<responsMessage.length;i+=chunkSizeLimit){
        const chunk=responsMessage.substring(i,i+chunkSizeLimit);

        await message.reply(chunk);
    }

});

client.login(process.env.TOKEN);