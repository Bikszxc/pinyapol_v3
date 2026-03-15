import { SlashCommandBuilder } from 'discord.js';

export const askCommand = new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask the knowledge base a question')
    .addStringOption(opt =>
        opt.setName('question')
            .setDescription('Your question')
            .setRequired(true)
    );
