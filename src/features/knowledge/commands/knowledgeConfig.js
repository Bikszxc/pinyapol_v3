import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const knowledgeConfigCommand = new SlashCommandBuilder()
    .setName('knowledge-config')
    .setDescription('Configure the knowledge base system')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName('view')
            .setDescription('View current knowledge base config')
    )
    .addSubcommand(sub =>
        sub.setName('add-ask-role')
            .setDescription('Add a role that can use /ask')
            .addRoleOption(opt =>
                opt.setName('role').setDescription('Role to add').setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('remove-ask-role')
            .setDescription('Remove a role from /ask access')
            .addRoleOption(opt =>
                opt.setName('role').setDescription('Role to remove').setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('add-contributor-role')
            .setDescription('Add a role that can contribute knowledge')
            .addRoleOption(opt =>
                opt.setName('role').setDescription('Role to add').setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('remove-contributor-role')
            .setDescription('Remove a role from contributor access')
            .addRoleOption(opt =>
                opt.setName('role').setDescription('Role to remove').setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('add-reviewer-role')
            .setDescription('Add a role that can review contributions')
            .addRoleOption(opt =>
                opt.setName('role').setDescription('Role to add').setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('remove-reviewer-role')
            .setDescription('Remove a role from reviewer access')
            .addRoleOption(opt =>
                opt.setName('role').setDescription('Role to remove').setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('set-n8n-ask-url')
            .setDescription('Set the n8n RAG webhook URL')
            .addStringOption(opt =>
                opt.setName('url').setDescription('Webhook URL').setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('set-n8n-ingest-url')
            .setDescription('Set the n8n ingest webhook URL')
            .addStringOption(opt =>
                opt.setName('url').setDescription('Webhook URL').setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('set-n8n-auth-key')
            .setDescription('Set the n8n webhook auth key (X-Api-Key)')
            .addStringOption(opt =>
                opt.setName('key').setDescription('Auth key').setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('set-log-channel')
            .setDescription('Set the knowledge activity log channel')
            .addChannelOption(opt =>
                opt.setName('channel').setDescription('Log channel').setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('add-category')
            .setDescription('Add a knowledge category')
            .addStringOption(opt =>
                opt.setName('name').setDescription('Category name (lowercase, no spaces)').setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('emoji').setDescription('Emoji for the category').setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('remove-category')
            .setDescription('Remove a knowledge category')
            .addStringOption(opt =>
                opt.setName('name').setDescription('Category name to remove').setRequired(true)
            )
    );
