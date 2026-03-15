import { MessageFlags } from 'discord.js';
import {
    getKnowledgeConfig, createPending, getNextPending,
    updatePending, countUserPending, searchDocsByTitle,
    getCategories, getContributorIds,
} from './db.js';
import { askQuestion, ingestDocument } from './rag.js';
import {
    buildAnswerCard, buildContributeModal, buildUploadModal,
    buildReviewCard, buildNoPendingCard, buildSearchResults,
    buildLogSubmittedCard, buildLogApprovedCard, buildLogRejectedCard,
    buildDmApprovedCard, buildDmRejectedCard,
} from './ui.js';

// ═══════════════════════════════════════════
//  PERMISSION HELPERS
// ═══════════════════════════════════════════

function hasRole(member, roleIds) {
    if (!roleIds || roleIds.length === 0) return true; // Empty = everyone
    return roleIds.some(id => member.roles.cache.has(id));
}

// ═══════════════════════════════════════════
//  APPLICATION EMOJI HELPER
// ═══════════════════════════════════════════

// Cache: userId -> emoji string
const emojiCache = new Map();

/**
 * Get or create an application emoji from a user's avatar.
 * @param {import('discord.js').Client} client
 * @param {string} userId
 * @returns {Promise<string|null>} Emoji string like <:kb_123:456> or null
 */
async function getOrCreateAvatarEmoji(client, userId) {
    // Check cache first
    if (emojiCache.has(userId)) return emojiCache.get(userId);

    try {
        const user = await client.users.fetch(userId);
        if (!user) return null;

        const emojiName = `kb_${userId.slice(-8)}`;

        // Check if emoji already exists
        const existingEmojis = await client.application.emojis.fetch();
        const existing = existingEmojis.find(e => e.name === emojiName);
        if (existing) {
            const str = `<:${existing.name}:${existing.id}>`;
            emojiCache.set(userId, str);
            return str;
        }

        // Download avatar
        const avatarURL = user.displayAvatarURL({ size: 128, extension: 'png' });
        const res = await fetch(avatarURL);
        const rawBuffer = Buffer.from(await res.arrayBuffer());

        // Crop to circle with sharp
        const { default: sharp } = await import('sharp');
        const size = 128;

        const circleMask = Buffer.from(
            `<svg width="${size}" height="${size}">
                <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/>
            </svg>`
        );

        const circularBuffer = await sharp(rawBuffer)
            .resize(size, size)
            .composite([{
                input: circleMask,
                blend: 'dest-in',
            }])
            .png()
            .toBuffer();

        // Create application emoji
        const emoji = await client.application.emojis.create({
            name: emojiName,
            attachment: circularBuffer,
        });

        const str = `<:${emoji.name}:${emoji.id}>`;
        emojiCache.set(userId, str);
        return str;
    } catch (err) {
        console.error('[Knowledge] Emoji creation error:', err);
        return null;
    }
}

// ═══════════════════════════════════════════
//  /ask
// ═══════════════════════════════════════════

/**
 * Handles /ask — query the knowledge base.
 */
export async function handleAsk(interaction, client) {
    const guildId = interaction.guildId;
    const config = await getKnowledgeConfig(guildId);

    // Check ask role permission
    if (!hasRole(interaction.member, config?.ask_role_ids)) {
        return interaction.reply({
            content: '❌ You don\'t have permission to use this command.',
            flags: MessageFlags.Ephemeral,
        });
    }

    if (!config?.n8n_ask_url) {
        return interaction.reply({
            content: '❌ Knowledge base is not configured yet. Ask an admin to run `/knowledge-config`.',
            flags: MessageFlags.Ephemeral,
        });
    }

    const question = interaction.options.getString('question');
    await interaction.deferReply();

    const startTime = Date.now();

    try {
        const result = await askQuestion(config, question, guildId);
        const answer = result?.response || result?.text || result?.output || 'Sorry, I couldn\'t find an answer.';
        const responseTime = ((Date.now() - startTime) / 1000).toFixed(1);

        // Fetch contributor info for attribution
        let contributor = null;
        try {
            const contributorIds = await getContributorIds(guildId);
            if (contributorIds.length > 0) {
                const contributorId = contributorIds[0];
                const avatarEmoji = await getOrCreateAvatarEmoji(client, contributorId);
                contributor = {
                    id: contributorId,
                    emoji: avatarEmoji,
                };
            }
        } catch (err) {
            console.error('[Knowledge] Contributor fetch error:', err);
        }

        const card = buildAnswerCard(question, answer, contributor, responseTime);
        return interaction.editReply({
            components: [card],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { users: [] },
        });
    } catch (err) {
        console.error('[Knowledge] Ask error:', err);
        return interaction.editReply({
            content: '❌ Something went wrong while querying the knowledge base. Please try again.',
        });
    }
}

// ═══════════════════════════════════════════
//  /knowledge contribute
// ═══════════════════════════════════════════

/**
 * Opens the contribute modal.
 */
export async function handleContribute(interaction) {
    const config = await getKnowledgeConfig(interaction.guildId);

    if (!hasRole(interaction.member, config?.contributor_role_ids)) {
        return interaction.reply({
            content: '❌ You don\'t have permission to contribute.',
            flags: MessageFlags.Ephemeral,
        });
    }

    // Check spam limit (max 5 pending per user)
    const pendingCount = await countUserPending(interaction.guildId, interaction.user.id);
    if (pendingCount >= 5) {
        return interaction.reply({
            content: '❌ You have too many pending contributions. Wait for them to be reviewed first.',
            flags: MessageFlags.Ephemeral,
        });
    }

    const modal = buildContributeModal();
    await interaction.showModal(modal);
}

/**
 * Handle contribute modal submission.
 */
export async function handleContributeSubmit(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const title = interaction.fields.getTextInputValue('knowledge_title');
    const category = interaction.fields.getTextInputValue('knowledge_category').toLowerCase().trim();
    const content = interaction.fields.getTextInputValue('knowledge_content');

    const pending = await createPending({
        guild_id: interaction.guildId,
        title,
        content,
        category,
        contributor_id: interaction.user.id,
    });

    if (!pending) {
        return interaction.editReply({ content: '❌ Failed to save your contribution. Please try again.' });
    }

    // Notify log channel
    const config = await getKnowledgeConfig(interaction.guildId);
    if (config?.log_channel_id) {
        try {
            const logChannel = await client.channels.fetch(config.log_channel_id);
            if (logChannel) {
                const logCard = buildLogSubmittedCard(interaction.user.id, title, category, 'text');
                await logChannel.send({
                    components: [logCard],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { users: [] },
                });
            }
        } catch (err) {
            console.error('[Knowledge] Log channel error:', err);
        }
    }

    return interaction.editReply({
        content: `✅ Your contribution **"${title}"** has been submitted for review! A staff member will review it soon.`,
    });
}

// ═══════════════════════════════════════════
//  /knowledge upload
// ═══════════════════════════════════════════

// Store file URLs temporarily for modal follow-up
const pendingUploads = new Map();

/**
 * Handle file upload — validates file, shows modal for metadata.
 */
export async function handleUpload(interaction) {
    const config = await getKnowledgeConfig(interaction.guildId);

    if (!hasRole(interaction.member, config?.contributor_role_ids)) {
        return interaction.reply({
            content: '❌ You don\'t have permission to upload.',
            flags: MessageFlags.Ephemeral,
        });
    }

    const file = interaction.options.getAttachment('file');

    // Validate extension
    const validExtensions = ['.txt', '.md'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(ext)) {
        return interaction.reply({
            content: '❌ Only `.txt` and `.md` files are accepted.',
            flags: MessageFlags.Ephemeral,
        });
    }

    // Validate size (50KB max)
    if (file.size > 50 * 1024) {
        return interaction.reply({
            content: '❌ File too large. Maximum size is **50KB**.',
            flags: MessageFlags.Ephemeral,
        });
    }

    // Store file URL for after modal submit
    pendingUploads.set(interaction.user.id, {
        url: file.url,
        filename: file.name,
        guildId: interaction.guildId,
        timestamp: Date.now(),
    });

    // Clean up old entries (older than 5 minutes)
    for (const [userId, data] of pendingUploads) {
        if (Date.now() - data.timestamp > 5 * 60 * 1000) {
            pendingUploads.delete(userId);
        }
    }

    const modal = buildUploadModal(file.name);
    await interaction.showModal(modal);
}

/**
 * Handle upload modal submission — reads file, saves as pending.
 */
export async function handleUploadSubmit(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const upload = pendingUploads.get(interaction.user.id);
    if (!upload) {
        return interaction.editReply({
            content: '❌ Upload session expired. Please use `/knowledge upload` again.',
        });
    }

    pendingUploads.delete(interaction.user.id);

    const title = interaction.fields.getTextInputValue('knowledge_title');
    const category = interaction.fields.getTextInputValue('knowledge_category').toLowerCase().trim();

    // Fetch file content
    let content;
    try {
        const res = await fetch(upload.url);
        content = await res.text();
    } catch (err) {
        console.error('[Knowledge] File fetch error:', err);
        return interaction.editReply({ content: '❌ Failed to read the file. Please try again.' });
    }

    if (!content || content.trim().length === 0) {
        return interaction.editReply({ content: '❌ File is empty.' });
    }

    const pending = await createPending({
        guild_id: upload.guildId,
        title,
        content,
        category,
        contributor_id: interaction.user.id,
    });

    if (!pending) {
        return interaction.editReply({ content: '❌ Failed to save your contribution. Please try again.' });
    }

    // Notify log channel
    const config = await getKnowledgeConfig(interaction.guildId);
    if (config?.log_channel_id) {
        try {
            const logChannel = await client.channels.fetch(config.log_channel_id);
            if (logChannel) {
                const logCard = buildLogSubmittedCard(interaction.user.id, title, category, 'file');
                await logChannel.send({
                    components: [logCard],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { users: [] },
                });
            }
        } catch (err) {
            console.error('[Knowledge] Log channel error:', err);
        }
    }

    return interaction.editReply({
        content: `✅ File **"${title}"** (${upload.filename}) submitted for review!`,
    });
}

// ═══════════════════════════════════════════
//  /knowledge review
// ═══════════════════════════════════════════

/**
 * Shows the next pending contribution for review.
 */
export async function handleReview(interaction) {
    const config = await getKnowledgeConfig(interaction.guildId);

    if (!hasRole(interaction.member, config?.reviewer_role_ids)) {
        return interaction.reply({
            content: '❌ You don\'t have permission to review contributions.',
            flags: MessageFlags.Ephemeral,
        });
    }

    const pending = await getNextPending(interaction.guildId);

    if (!pending) {
        const card = buildNoPendingCard();
        return interaction.reply({
            components: [card],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
    }

    const card = buildReviewCard(pending);
    return interaction.reply({
        components: [card],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
}

/**
 * Handle approve button on review card.
 */
export async function handleApprove(interaction, client) {
    const pendingId = parseInt(interaction.customId.replace('knowledge_approve_', ''));
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const config = await getKnowledgeConfig(interaction.guildId);

    // Update pending status
    const updated = await updatePending(pendingId, {
        status: 'approved',
        reviewer_id: interaction.user.id,
        reviewed_at: new Date().toISOString(),
    });

    if (!updated) {
        return interaction.editReply({ content: '❌ Could not find this contribution.' });
    }

    // Ingest into knowledge base via n8n
    try {
        await ingestDocument(config, {
            title: updated.title,
            content: updated.content,
            category: updated.category,
            contributor_id: updated.contributor_id,
            guild_id: updated.guild_id,
        });
    } catch (err) {
        console.error('[Knowledge] Ingest error:', err);
        return interaction.editReply({
            content: '❌ Approved but failed to ingest into knowledge base. Check n8n config.',
        });
    }

    // DM the contributor
    try {
        const guild = await client.guilds.fetch(interaction.guildId);
        const contributor = await client.users.fetch(updated.contributor_id);
        if (contributor) {
            const dmCard = buildDmApprovedCard(updated.title, guild.name);
            await contributor.send({
                components: [dmCard],
                flags: MessageFlags.IsComponentsV2,
            });
        }
    } catch {
        // DMs might be disabled
    }

    // Log
    if (config?.log_channel_id) {
        try {
            const logChannel = await client.channels.fetch(config.log_channel_id);
            if (logChannel) {
                const logCard = buildLogApprovedCard(updated.title, updated.contributor_id, interaction.user.id);
                await logChannel.send({
                    components: [logCard],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { users: [] },
                });
            }
        } catch {}
    }

    return interaction.editReply({
        content: `✅ **"${updated.title}"** approved and ingested into the knowledge base.`,
    });
}

/**
 * Handle reject button on review card.
 */
export async function handleReject(interaction, client) {
    const pendingId = parseInt(interaction.customId.replace('knowledge_reject_', ''));
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const updated = await updatePending(pendingId, {
        status: 'rejected',
        reviewer_id: interaction.user.id,
        reviewed_at: new Date().toISOString(),
    });

    if (!updated) {
        return interaction.editReply({ content: '❌ Could not find this contribution.' });
    }

    // DM the contributor
    try {
        const guild = await client.guilds.fetch(interaction.guildId);
        const contributor = await client.users.fetch(updated.contributor_id);
        if (contributor) {
            const dmCard = buildDmRejectedCard(updated.title, guild.name);
            await contributor.send({
                components: [dmCard],
                flags: MessageFlags.IsComponentsV2,
            });
        }
    } catch {}

    return interaction.editReply({
        content: `❌ **"${updated.title}"** rejected.`,
    });
}

/**
 * Handle skip button — shows next pending.
 */
export async function handleSkip(interaction) {
    // Just show the next one
    return handleReview(interaction);
}

// ═══════════════════════════════════════════
//  /knowledge search
// ═══════════════════════════════════════════

/**
 * Search the knowledge base.
 */
export async function handleSearch(interaction) {
    const config = await getKnowledgeConfig(interaction.guildId);

    if (!hasRole(interaction.member, config?.contributor_role_ids)) {
        return interaction.reply({
            content: '❌ You don\'t have permission to search.',
            flags: MessageFlags.Ephemeral,
        });
    }

    const query = interaction.options.getString('query');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const results = await searchDocsByTitle(interaction.guildId, query);
    const card = buildSearchResults(query, results);

    return interaction.editReply({
        components: [card],
        flags: MessageFlags.IsComponentsV2,
    });
}
