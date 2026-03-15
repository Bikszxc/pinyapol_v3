import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';

export const ticketConfigCommand = new SlashCommandBuilder()
    .setName('ticket-config')
    .setDescription('Configure the ticketing system')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
        .setName('view')
        .setDescription('View current ticketing configuration')
    )
    .addSubcommand(sub => sub
        .setName('set-category')
        .setDescription('Set the Discord category for ticket channels')
        .addChannelOption(opt => opt
            .setName('category')
            .setDescription('The channel category to create tickets in')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
    )
    .addSubcommand(sub => sub
        .setName('set-staff-role')
        .setDescription('Set the role that can see & claim tickets')
        .addRoleOption(opt => opt
            .setName('role')
            .setDescription('The staff role')
            .setRequired(true)
        )
    )
    .addSubcommand(sub => sub
        .setName('set-staff-channel')
        .setDescription('Set the channel for staff notifications & dashboard')
        .addChannelOption(opt => opt
            .setName('channel')
            .setDescription('The staff channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub => sub
        .setName('set-log-channel')
        .setDescription('Set the channel for closed ticket transcripts')
        .addChannelOption(opt => opt
            .setName('channel')
            .setDescription('The log channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub => sub
        .setName('set-max-tickets')
        .setDescription('Set max open tickets per user')
        .addIntegerOption(opt => opt
            .setName('max')
            .setDescription('Maximum open tickets per user (1-10)')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(true)
        )
    )
    .addSubcommand(sub => sub
        .setName('set-idle-reminder')
        .setDescription('Set hours before idle ticket reminder (0 = disabled)')
        .addIntegerOption(opt => opt
            .setName('hours')
            .setDescription('Hours before reminder (0 = disabled)')
            .setMinValue(0)
            .setMaxValue(168)
            .setRequired(true)
        )
    )
    .addSubcommand(sub => sub
        .setName('set-auto-close')
        .setDescription('Set hours after reminder before auto-close (0 = disabled)')
        .addIntegerOption(opt => opt
            .setName('hours')
            .setDescription('Hours after reminder before auto-close (0 = disabled)')
            .setMinValue(0)
            .setMaxValue(168)
            .setRequired(true)
        )
    )
    .addSubcommand(sub => sub
        .setName('add-type')
        .setDescription('Add a new ticket category')
        .addStringOption(opt => opt
            .setName('key')
            .setDescription('Unique key (lowercase, no spaces, e.g. "bug_report")')
            .setRequired(true)
        )
        .addStringOption(opt => opt
            .setName('label')
            .setDescription('Display name (e.g. "Bug Report")')
            .setRequired(true)
        )
        .addStringOption(opt => opt
            .setName('emoji')
            .setDescription('Emoji for the button (e.g. "🐛")')
            .setRequired(true)
        )
        .addStringOption(opt => opt
            .setName('color')
            .setDescription('Hex color (e.g. "#E74C3C")')
            .setRequired(true)
        )
        .addStringOption(opt => opt
            .setName('description')
            .setDescription('Short description of this category')
            .setRequired(true)
        )
    )
    .addSubcommand(sub => sub
        .setName('remove-type')
        .setDescription('Remove a ticket category')
        .addStringOption(opt => opt
            .setName('key')
            .setDescription('The key of the category to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(sub => sub
        .setName('list-types')
        .setDescription('List all configured ticket categories')
    );
