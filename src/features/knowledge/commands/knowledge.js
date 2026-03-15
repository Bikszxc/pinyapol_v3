import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const knowledgeCommand = new SlashCommandBuilder()
    .setName('knowledge')
    .setDescription('Knowledge base management')
    .addSubcommand(sub =>
        sub.setName('contribute')
            .setDescription('Submit knowledge for review')
    )
    .addSubcommand(sub =>
        sub.setName('upload')
            .setDescription('Upload a .txt or .md file as knowledge')
            .addAttachmentOption(opt =>
                opt.setName('file')
                    .setDescription('A .txt or .md file (max 50KB)')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('review')
            .setDescription('Review pending contributions')
    )
    .addSubcommand(sub =>
        sub.setName('search')
            .setDescription('Search existing knowledge entries')
            .addStringOption(opt =>
                opt.setName('query')
                    .setDescription('Search query')
                    .setRequired(true)
            )
    );
