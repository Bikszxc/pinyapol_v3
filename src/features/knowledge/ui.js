import {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ThumbnailBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';

// ═══════════════════════════════════════════
//  ANSWER CARD (Response to /ask)
// ═══════════════════════════════════════════

/**
 * Builds the V2 answer card with contributor attribution footer.
 * @param {string} question - Original question
 * @param {string} answer - LLM answer text
 * @param {object|null} contributor - { username, avatarURL } or null
 * @param {number} responseTime - Response time in seconds
 * @returns {ContainerBuilder}
 */
export function buildAnswerCard(question, answer, contributor, responseTime) {
    const container = new ContainerBuilder()
        .setAccentColor(0x2ECC71); // green

    // Header
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# 🧠 PinyaBot Knowledge')
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    // Question
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**❓ ${question}**`)
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    // Answer
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(answer)
    );

    // Footer with attribution
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    if (contributor && contributor.id) {
        const avatarPart = contributor.emoji ? `${contributor.emoji} ` : '';
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# ${avatarPart}Contributed by <@${contributor.id}> | ⚡ Answered in ${responseTime}s`)
        );
    } else {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# ⚡ Answered in ${responseTime}s`)
        );
    }

    return container;
}

// ═══════════════════════════════════════════
//  CONTRIBUTE MODAL
// ═══════════════════════════════════════════

/**
 * Builds the contribute modal for text submissions.
 * @returns {ModalBuilder}
 */
export function buildContributeModal() {
    const modal = new ModalBuilder()
        .setCustomId('knowledge_contribute_modal')
        .setTitle('📝 Contribute Knowledge');

    const titleInput = new TextInputBuilder()
        .setCustomId('knowledge_title')
        .setLabel('Title')
        .setPlaceholder('e.g. Base Building Tips')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(true);

    const categoryInput = new TextInputBuilder()
        .setCustomId('knowledge_category')
        .setLabel('Category')
        .setPlaceholder('gameplay, rules, mods, tips, or general')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(50)
        .setRequired(true);

    const contentInput = new TextInputBuilder()
        .setCustomId('knowledge_content')
        .setLabel('Content')
        .setPlaceholder('Write your knowledge here...')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(4000)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(categoryInput),
        new ActionRowBuilder().addComponents(contentInput),
    );

    return modal;
}

// ═══════════════════════════════════════════
//  UPLOAD MODAL (for file uploads)
// ═══════════════════════════════════════════

/**
 * Builds the upload modal for file metadata.
 * @param {string} filename - Pre-filled from the attachment
 * @returns {ModalBuilder}
 */
export function buildUploadModal(filename) {
    const modal = new ModalBuilder()
        .setCustomId('knowledge_upload_modal')
        .setTitle('📄 Upload Knowledge');

    const titleInput = new TextInputBuilder()
        .setCustomId('knowledge_title')
        .setLabel('Title')
        .setValue(filename.replace(/\.(txt|md)$/i, ''))
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(true);

    const categoryInput = new TextInputBuilder()
        .setCustomId('knowledge_category')
        .setLabel('Category')
        .setPlaceholder('tips')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(50)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(categoryInput),
    );

    return modal;
}

// ═══════════════════════════════════════════
//  REVIEW CARD (staff reviews pending)
// ═══════════════════════════════════════════

/**
 * Builds a V2 review card for a pending contribution.
 * @param {object} pending - Pending contribution record
 * @returns {ContainerBuilder}
 */
export function buildReviewCard(pending) {
    const container = new ContainerBuilder()
        .setAccentColor(0xE67E22); // orange

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# 📋 Pending Contribution')
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    const details = [
        `📝 **Title:** ${pending.title}`,
        `🏷️ **Category:** ${pending.category}`,
        `👤 **By:** <@${pending.contributor_id}>`,
        `📅 **Submitted:** <t:${Math.floor(new Date(pending.created_at).getTime() / 1000)}:R>`,
    ].join('\n');

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(details)
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    // Preview content (truncated)
    const preview = pending.content.length > 500
        ? pending.content.substring(0, 500) + '\n\n*... content truncated ...*'
        : pending.content;

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(preview)
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    );

    // Action buttons
    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`knowledge_approve_${pending.id}`)
            .setLabel('Approve')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`knowledge_reject_${pending.id}`)
            .setLabel('Reject')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('knowledge_skip')
            .setLabel('Skip')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary),
    );
    container.addActionRowComponents(buttonRow);

    return container;
}

// ═══════════════════════════════════════════
//  NO PENDING CARD
// ═══════════════════════════════════════════

export function buildNoPendingCard() {
    const container = new ContainerBuilder()
        .setAccentColor(0x95A5A6);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# 📋 Review Queue\n\n✅ No pending contributions! All caught up.')
    );

    return container;
}

// ═══════════════════════════════════════════
//  SEARCH RESULTS
// ═══════════════════════════════════════════

/**
 * Builds a V2 card with search results.
 * @param {string} query - Search query
 * @param {Array} results - Search results
 * @returns {ContainerBuilder}
 */
export function buildSearchResults(query, results) {
    const container = new ContainerBuilder()
        .setAccentColor(0x3498DB);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# 🔍 Search: "${query}"`)
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    if (results.length === 0) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent('No results found.')
        );
    } else {
        const lines = results.map((r, i) => {
            const title = r.metadata?.title || 'Untitled';
            const category = r.metadata?.category || 'general';
            const preview = r.content?.substring(0, 100) || '';
            return `**${i + 1}. ${title}** (${category})\n> ${preview}...`;
        }).join('\n\n');

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(lines)
        );
    }

    return container;
}

// ═══════════════════════════════════════════
//  CONFIG VIEW
// ═══════════════════════════════════════════

/**
 * Builds a V2 card showing the current knowledge config.
 * @param {object} config - Knowledge config or null
 * @param {number} pendingCount - Count of pending contributions
 * @returns {ContainerBuilder}
 */
export function buildConfigView(config, pendingCount) {
    const container = new ContainerBuilder()
        .setAccentColor(0x9B59B6);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# ⚙️ Knowledge Base Config')
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    const askRoles = config?.ask_role_ids?.length
        ? config.ask_role_ids.map(r => `<@&${r}>`).join(', ')
        : 'Everyone';
    const contribRoles = config?.contributor_role_ids?.length
        ? config.contributor_role_ids.map(r => `<@&${r}>`).join(', ')
        : 'Not set';
    const reviewRoles = config?.reviewer_role_ids?.length
        ? config.reviewer_role_ids.map(r => `<@&${r}>`).join(', ')
        : 'Not set';

    const categories = config?.categories || [];
    const catList = categories.map(c => {
        if (typeof c === 'string') return c;
        return `${c.emoji} ${c.name}`;
    }).join(', ') || 'Default';

    const lines = [
        `### 👥 Roles`,
        `**Ask:** ${askRoles}`,
        `**Contributor:** ${contribRoles}`,
        `**Reviewer:** ${reviewRoles}`,
        '',
        `### 🔗 n8n Integration`,
        `**Ask URL:** ${config?.n8n_ask_url ? '✅ Set' : '❌ Not set'}`,
        `**Ingest URL:** ${config?.n8n_ingest_url ? '✅ Set' : '❌ Not set'}`,
        `**Auth Key:** ${config?.n8n_auth_key ? '🔑 Set' : '❌ Not set'}`,
        '',
        `### 📂 Settings`,
        `**Log Channel:** ${config?.log_channel_id ? `<#${config.log_channel_id}>` : 'Not set'}`,
        `**Categories:** ${catList}`,
        `**Pending:** ${pendingCount} contribution(s) awaiting review`,
    ].join('\n');

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(lines)
    );

    return container;
}

// ═══════════════════════════════════════════
//  LOG CHANNEL NOTIFICATIONS
// ═══════════════════════════════════════════

/**
 * Builds a V2 card for log channel — new contribution submitted.
 */
export function buildLogSubmittedCard(userId, title, category, type = 'text') {
    const icon = type === 'file' ? '📄' : '📥';
    const label = type === 'file' ? 'File Upload' : 'Text Contribution';

    const container = new ContainerBuilder()
        .setAccentColor(0x3498DB); // blue

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ${icon} New ${label}`)
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**Title:** ${title}\n**Category:** ${category}\n**By:** <@${userId}>`
        )
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Use \`/knowledge review\` to review`)
    );

    return container;
}

/**
 * Builds a V2 card for log channel — contribution approved.
 */
export function buildLogApprovedCard(title, contributorId, reviewerId) {
    const container = new ContainerBuilder()
        .setAccentColor(0x2ECC71); // green

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ✅ Contribution Approved`)
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**Title:** ${title}\n**By:** <@${contributorId}>\n**Approved by:** <@${reviewerId}>`
        )
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Added to the knowledge base`)
    );

    return container;
}

/**
 * Builds a V2 card for log channel — contribution rejected.
 */
export function buildLogRejectedCard(title, contributorId, reviewerId) {
    const container = new ContainerBuilder()
        .setAccentColor(0xE74C3C); // red

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ❌ Contribution Rejected`)
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `**Title:** ${title}\n**By:** <@${contributorId}>\n**Rejected by:** <@${reviewerId}>`
        )
    );

    return container;
}

// ═══════════════════════════════════════════
//  CONTRIBUTOR DM NOTIFICATIONS
// ═══════════════════════════════════════════

/**
 * Builds a V2 card DM — contribution approved.
 */
export function buildDmApprovedCard(title, guildName) {
    const container = new ContainerBuilder()
        .setAccentColor(0x2ECC71);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### 🎉 Contribution Approved!`)
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `Your contribution **"${title}"** has been approved and added to the **${guildName}** knowledge base!\n\nPlayers can now find your knowledge when they use \`/ask\`. Thank you for contributing! 💪`
        )
    );

    return container;
}

/**
 * Builds a V2 card DM — contribution rejected.
 */
export function buildDmRejectedCard(title, guildName) {
    const container = new ContainerBuilder()
        .setAccentColor(0xE74C3C);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ❌ Contribution Not Approved`)
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `Your contribution **"${title}"** for **${guildName}** was not approved.\n\nFeel free to revise and resubmit with \`/knowledge contribute\`.`
        )
    );

    return container;
}
