import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const ticketSetupCommand = new SlashCommandBuilder()
    .setName('ticket-setup')
    .setDescription('Deploy or refresh the ticket panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
        .setName('deploy')
        .setDescription('Deploy the ticket panel to this channel')
    )
    .addSubcommand(sub => sub
        .setName('refresh')
        .setDescription('Refresh the existing ticket panel with updated categories')
    );
