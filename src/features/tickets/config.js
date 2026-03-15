import {
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
} from 'discord.js';
import { getConfig, upsertConfig, getCategories, addCategory, removeCategory } from './db.js';
import { buildTicketPanel } from './ui.js';

/**
 * Handles all /ticket-config subcommands.
 */
export async function handleConfigCommand(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    switch (sub) {
        case 'view':
            return handleView(interaction, guildId);
        case 'set-category':
            return handleSetValue(interaction, guildId, 'category_id', interaction.options.getChannel('category').id, 'Ticket category');
        case 'set-staff-role':
            return handleSetValue(interaction, guildId, 'staff_role_id', interaction.options.getRole('role').id, 'Staff role');
        case 'set-staff-channel':
            return handleSetValue(interaction, guildId, 'staff_channel_id', interaction.options.getChannel('channel').id, 'Staff channel');
        case 'set-log-channel':
            return handleSetValue(interaction, guildId, 'log_channel_id', interaction.options.getChannel('channel').id, 'Log channel');
        case 'set-max-tickets':
            return handleSetValue(interaction, guildId, 'max_tickets_per_user', interaction.options.getInteger('max'), 'Max tickets per user');
        case 'set-idle-reminder':
            return handleSetValue(interaction, guildId, 'idle_reminder_hours', interaction.options.getInteger('hours'), 'Idle reminder');
        case 'set-auto-close':
            return handleSetValue(interaction, guildId, 'auto_close_hours', interaction.options.getInteger('hours'), 'Auto-close');
        case 'add-type':
            return handleAddType(interaction, guildId);
        case 'remove-type':
            return handleRemoveType(interaction, guildId);
        case 'list-types':
            return handleListTypes(interaction, guildId);
        default:
            return interaction.reply({ content: 'Unknown subcommand.', flags: MessageFlags.Ephemeral });
    }
}

/**
 * Handles all /ticket-setup subcommands.
 */
export async function handleSetupCommand(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const config = await getConfig(guildId);

    if (!config || !config.category_id || !config.staff_role_id || !config.staff_channel_id) {
        return interaction.reply({
            content: '❌ **Ticketing not fully configured.** Please set the following first:\n' +
                '• `/ticket-config set-category`\n' +
                '• `/ticket-config set-staff-role`\n' +
                '• `/ticket-config set-staff-channel`',
            flags: MessageFlags.Ephemeral,
        });
    }

    const categories = await getCategories(guildId);
    const panel = buildTicketPanel(categories);

    if (sub === 'deploy') {
        const msg = await interaction.channel.send({
            components: [panel],
            flags: MessageFlags.IsComponentsV2,
        });

        await upsertConfig(guildId, {
            panel_channel_id: interaction.channelId,
            panel_message_id: msg.id,
        });

        return interaction.reply({
            content: '✅ Ticket panel deployed!',
            flags: MessageFlags.Ephemeral,
        });
    }

    if (sub === 'refresh') {
        if (!config.panel_channel_id || !config.panel_message_id) {
            return interaction.reply({
                content: '❌ No existing panel found. Use `/ticket-setup deploy` first.',
                flags: MessageFlags.Ephemeral,
            });
        }

        try {
            const channel = await interaction.guild.channels.fetch(config.panel_channel_id);
            const message = await channel.messages.fetch(config.panel_message_id);
            await message.edit({
                components: [panel],
                flags: MessageFlags.IsComponentsV2,
            });

            return interaction.reply({
                content: '✅ Ticket panel refreshed!',
                flags: MessageFlags.Ephemeral,
            });
        } catch (err) {
            console.error('[Tickets] Error refreshing panel:', err);
            return interaction.reply({
                content: '❌ Could not find the existing panel. Try deploying a new one with `/ticket-setup deploy`.',
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}

// ═══════════════════════════════════════════
//  INTERNAL HANDLERS
// ═══════════════════════════════════════════

async function handleSetValue(interaction, guildId, field, value, label) {
    try {
        await upsertConfig(guildId, { [field]: value });

        const displayValue = typeof value === 'number' ? `\`${value}\`` : `<#${value}>`.replace(/<#(\d+)>/, (_, id) => {
            // Check if it's a role or channel
            if (field.includes('role')) return `<@&${id}>`;
            if (field === 'category_id') return `\`${value}\``;
            return `<#${id}>`;
        });

        return interaction.reply({
            content: `✅ **${label}** updated to ${displayValue}`,
            flags: MessageFlags.Ephemeral,
        });
    } catch (err) {
        console.error(`[Tickets] Error setting ${field}:`, err);
        return interaction.reply({
            content: `❌ Failed to update ${label}. Please try again.`,
            flags: MessageFlags.Ephemeral,
        });
    }
}

async function handleView(interaction, guildId) {
    const config = await getConfig(guildId);
    const categories = await getCategories(guildId);

    const lines = [
        '## ⚙️ Ticket Configuration',
        '',
        `**Ticket Category:** ${config?.category_id ? `<#${config.category_id}>` : '❌ Not set'}`,
        `**Staff Role:** ${config?.staff_role_id ? `<@&${config.staff_role_id}>` : '❌ Not set'}`,
        `**Staff Channel:** ${config?.staff_channel_id ? `<#${config.staff_channel_id}>` : '❌ Not set'}`,
        `**Log Channel:** ${config?.log_channel_id ? `<#${config.log_channel_id}>` : '⚠️ Not set'}`,
        `**Panel:** ${config?.panel_message_id ? `Deployed in <#${config.panel_channel_id}>` : '⚠️ Not deployed'}`,
        '',
        `**Max Tickets/User:** \`${config?.max_tickets_per_user ?? 3}\``,
        `**Idle Reminder:** \`${config?.idle_reminder_hours ?? 24}h\``,
        `**Auto-Close:** \`${config?.auto_close_hours ?? 48}h\``,
        `**Ticket Counter:** \`#${config?.ticket_counter ?? 0}\``,
        '',
        `**Categories:** ${categories.length}`,
        categories.map(c => `> ${c.emoji} **${c.label}** (\`${c.key}\`) — ${c.description}`).join('\n'),
    ];

    const container = new ContainerBuilder()
        .setAccentColor(0x3498DB)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

    return interaction.reply({
        components: [container],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
}

async function handleAddType(interaction, guildId) {
    const key = interaction.options.getString('key').toLowerCase().replace(/\s+/g, '_');
    const label = interaction.options.getString('label');
    const emoji = interaction.options.getString('emoji');
    const color = interaction.options.getString('color');
    const description = interaction.options.getString('description');

    try {
        await addCategory(guildId, { key, label, emoji, color, description });
        return interaction.reply({
            content: `✅ Added category: ${emoji} **${label}** (\`${key}\`)`,
            flags: MessageFlags.Ephemeral,
        });
    } catch (err) {
        return interaction.reply({
            content: `❌ ${err.message}`,
            flags: MessageFlags.Ephemeral,
        });
    }
}

async function handleRemoveType(interaction, guildId) {
    const key = interaction.options.getString('key');

    try {
        await removeCategory(guildId, key);
        return interaction.reply({
            content: `✅ Removed category: \`${key}\``,
            flags: MessageFlags.Ephemeral,
        });
    } catch (err) {
        return interaction.reply({
            content: `❌ ${err.message}`,
            flags: MessageFlags.Ephemeral,
        });
    }
}

async function handleListTypes(interaction, guildId) {
    const categories = await getCategories(guildId);

    const lines = [
        '## 📋 Ticket Categories',
        '',
        ...categories.map((c, i) => `${i + 1}. ${c.emoji} **${c.label}** — \`${c.key}\`\n> ${c.description} • Color: \`${c.color}\``),
    ];

    const container = new ContainerBuilder()
        .setAccentColor(0x2ECC71)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

    return interaction.reply({
        components: [container],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
}
