import { SlashCommandBuilder } from 'discord.js';

export const ticketCloseCommand = new SlashCommandBuilder()
    .setName('ticket-close')
    .setDescription('Close the current ticket')
    .addStringOption(opt => opt
        .setName('reason')
        .setDescription('Reason for closing')
        .setRequired(false)
    );
