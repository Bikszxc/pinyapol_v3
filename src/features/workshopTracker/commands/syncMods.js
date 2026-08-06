import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const syncModsCommand = new SlashCommandBuilder()
    .setName('workshop-sync')
    .setDescription('Force syncs all tracked mods last_updated timestamp from Steam without sending notifications.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
