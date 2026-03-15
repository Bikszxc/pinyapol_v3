import { MessageFlags } from 'discord.js';
import {
    getKnowledgeConfig, upsertKnowledgeConfig,
    addRoleToList, removeRoleFromList,
    addCategory, removeCategory, getCategories,
    getPendingCount,
} from './db.js';
import { buildConfigView } from './ui.js';

/**
 * Handle /knowledge-config subcommands.
 */
export async function handleKnowledgeConfigCommand(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    switch (sub) {
        case 'view':
            return handleView(interaction, guildId);

        // ── Role management ──
        case 'add-ask-role':
            return handleRoleChange(interaction, guildId, 'ask_role_ids', 'add');
        case 'remove-ask-role':
            return handleRoleChange(interaction, guildId, 'ask_role_ids', 'remove');
        case 'add-contributor-role':
            return handleRoleChange(interaction, guildId, 'contributor_role_ids', 'add');
        case 'remove-contributor-role':
            return handleRoleChange(interaction, guildId, 'contributor_role_ids', 'remove');
        case 'add-reviewer-role':
            return handleRoleChange(interaction, guildId, 'reviewer_role_ids', 'add');
        case 'remove-reviewer-role':
            return handleRoleChange(interaction, guildId, 'reviewer_role_ids', 'remove');

        // ── URLs & keys ──
        case 'set-n8n-ask-url':
            return handleSetString(interaction, guildId, 'n8n_ask_url', 'n8n Ask URL');
        case 'set-n8n-ingest-url':
            return handleSetString(interaction, guildId, 'n8n_ingest_url', 'n8n Ingest URL');
        case 'set-n8n-auth-key':
            return handleSetString(interaction, guildId, 'n8n_auth_key', 'n8n Auth Key');
        case 'set-log-channel':
            return handleSetChannel(interaction, guildId);

        // ── Categories ──
        case 'add-category':
            return handleAddCategory(interaction, guildId);
        case 'remove-category':
            return handleRemoveCategory(interaction, guildId);

        default:
            return interaction.reply({ content: '❌ Unknown subcommand.', flags: MessageFlags.Ephemeral });
    }
}

async function handleView(interaction, guildId) {
    const config = await getKnowledgeConfig(guildId);
    const pendingCount = await getPendingCount(guildId);
    const card = buildConfigView(config, pendingCount);

    return interaction.reply({
        components: [card],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
}

async function handleRoleChange(interaction, guildId, listKey, action) {
    const role = interaction.options.getRole('role');
    const friendlyNames = {
        ask_role_ids: 'Ask',
        contributor_role_ids: 'Contributor',
        reviewer_role_ids: 'Reviewer',
    };
    const name = friendlyNames[listKey];

    let result;
    if (action === 'add') {
        result = await addRoleToList(guildId, listKey, role.id);
    } else {
        result = await removeRoleFromList(guildId, listKey, role.id);
    }

    if (result?.error) {
        return interaction.reply({ content: `❌ ${result.error}`, flags: MessageFlags.Ephemeral });
    }

    const verb = action === 'add' ? 'added to' : 'removed from';
    return interaction.reply({
        content: `✅ <@&${role.id}> ${verb} **${name}** roles.`,
        flags: MessageFlags.Ephemeral,
    });
}

async function handleSetString(interaction, guildId, field, label) {
    const value = interaction.options.getString('url') || interaction.options.getString('key');
    await upsertKnowledgeConfig(guildId, { [field]: value });

    // Mask sensitive values
    const display = field === 'n8n_auth_key'
        ? `${value.substring(0, 8)}...`
        : value;

    return interaction.reply({
        content: `✅ **${label}** set to \`${display}\``,
        flags: MessageFlags.Ephemeral,
    });
}

async function handleSetChannel(interaction, guildId) {
    const channel = interaction.options.getChannel('channel');
    await upsertKnowledgeConfig(guildId, { log_channel_id: channel.id });

    return interaction.reply({
        content: `✅ **Log Channel** set to <#${channel.id}>`,
        flags: MessageFlags.Ephemeral,
    });
}

async function handleAddCategory(interaction, guildId) {
    const name = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-');
    const emoji = interaction.options.getString('emoji');
    const result = await addCategory(guildId, name, emoji);

    if (result?.error) {
        return interaction.reply({ content: `❌ ${result.error}`, flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({
        content: `✅ Category **${emoji} ${name}** added.`,
        flags: MessageFlags.Ephemeral,
    });
}

async function handleRemoveCategory(interaction, guildId) {
    const name = interaction.options.getString('name');
    const result = await removeCategory(guildId, name);

    if (result?.error) {
        return interaction.reply({ content: `❌ ${result.error}`, flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({
        content: `✅ Category **${name}** removed.`,
        flags: MessageFlags.Ephemeral,
    });
}
