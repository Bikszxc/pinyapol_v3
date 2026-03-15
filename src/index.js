import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { loadFeatures } from './core/loader.js';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ]
});

client.once('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Store the client ID for command registration
    process.env.CLIENT_ID = client.user.id;

    await loadFeatures(client);
});

client.login(process.env.DISCORD_TOKEN);
