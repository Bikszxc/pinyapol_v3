import {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
} from 'discord.js';

// ═══════════════════════════════════════════
//  TICKET PANEL (deployed in #support)
// ═══════════════════════════════════════════

/**
 * Builds the main ticket panel — the Components V2 message users interact with.
 * @param {Array} categories - Array of { key, label, emoji, color, description }
 * @returns {ContainerBuilder}
 */
export function buildTicketPanel(categories) {
    const container = new ContainerBuilder()
        .setAccentColor(0xFED405);

    // Header
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# 🎫 Support Tickets')
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            'Need help? Select a category below to create a ticket.\nA staff member will assist you shortly.'
        )
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    // Category description list
    const categoryLines = categories.map(c => `${c.emoji} **${c.label}** — ${c.description}`).join('\n');
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(categoryLines)
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    );

    // Category dropdown
    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ticket_category_select')
            .setPlaceholder('🎫 Choose a category...')
            .addOptions(
                categories.map(cat => ({
                    label: cat.label,
                    value: cat.key,
                    emoji: cat.emoji,
                    description: cat.description.substring(0, 100),
                }))
            )
    );

    container.addActionRowComponents(selectRow);

    return container;
}

// ═══════════════════════════════════════════
//  INTAKE MODAL (pops up when category clicked)
// ═══════════════════════════════════════════

/**
 * Builds the ticket creation modal for a given category.
 * @param {object} category - { key, label, emoji }
 * @returns {ModalBuilder}
 */
export function buildIntakeModal(category) {
    return new ModalBuilder()
        .setCustomId(`ticket_modal_${category.key}`)
        .setTitle(`${category.emoji} ${category.label}`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('ticket_title')
                    .setLabel('Title')
                    .setPlaceholder('Brief summary of your issue')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(100)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('ticket_description')
                    .setLabel('Description')
                    .setPlaceholder('Describe your issue in detail...')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(1000)
                    .setRequired(true)
            ),
        );
}

// ═══════════════════════════════════════════
//  TICKET CARD (inside ticket channel)
// ═══════════════════════════════════════════

const STATUS_STYLES = {
    open: { emoji: '🟡', label: 'Waiting for Staff', color: 0xF1C40F },
    claimed: { emoji: '⏳', label: 'In Progress', color: 0x3498DB },
    resolved: { emoji: '✅', label: 'Resolved', color: 0x2ECC71 },
    closed: { emoji: '🔒', label: 'Closed', color: 0x95A5A6 },
};

const PRIORITY_LABELS = {
    low: '🟢 Low',
    medium: '🟡 Medium',
    high: '🟠 High',
    urgent: '🔴 Urgent',
};

/**
 * Builds the live ticket card shown inside the ticket channel.
 * @param {object} ticket - Ticket record from DB
 * @param {object} category - Category info { emoji, label, color }
 * @returns {ContainerBuilder}
 */
export function buildTicketCard(ticket, category) {
    const style = STATUS_STYLES[ticket.status] || STATUS_STYLES.open;

    const container = new ContainerBuilder()
        .setAccentColor(parseInt(category.color?.replace('#', ''), 16) || style.color);

    // Header
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ${category.emoji} ${category.label} — Ticket #${String(ticket.ticket_number).padStart(4, '0')}`
        )
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    // Details
    const detailLines = [
        `📝 **Title**`,
        ticket.title,
        '',
        `📋 **Description**`,
        ticket.description,
        '',
        `${PRIORITY_LABELS[ticket.priority] || '🟡 Medium'} Priority`,
        `👤 **Opened by:** <@${ticket.user_id}>`,
        `📅 **Created:** <t:${Math.floor(new Date(ticket.created_at).getTime() / 1000)}:R>`,
    ];

    if (ticket.staff_id) {
        detailLines.push(`🛡️ **Assigned to:** <@${ticket.staff_id}>`);
    }

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(detailLines.join('\n'))
    );

    // Status bar
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`${style.emoji} **Status:** ${style.label}`)
    );

    // Action buttons based on status
    const buttonRow = new ActionRowBuilder();

    if (ticket.status === 'open') {
        buttonRow.addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_claim')
                .setLabel('Claim')
                .setEmoji('🙋')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel('Close')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger),
        );
    } else if (ticket.status === 'claimed') {
        buttonRow.addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_resolve')
                .setLabel('Resolve')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel('Close')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger),
        );
    } else if (ticket.status === 'resolved') {
        buttonRow.addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_reopen')
                .setLabel('Reopen')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel('Confirm Close')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger),
        );
    }

    if (buttonRow.components.length > 0) {
        container.addActionRowComponents(buttonRow);
    }

    return container;
}

// ═══════════════════════════════════════════
//  STAFF NOTIFICATION
// ═══════════════════════════════════════════

/**
 * Builds the notification card sent to the staff channel.
 * @param {object} ticket - Ticket record
 * @param {object} category - Category info
 * @returns {ContainerBuilder}
 */
export function buildStaffNotification(ticket, category) {
    const container = new ContainerBuilder()
        .setAccentColor(parseInt(category.color?.replace('#', ''), 16) || 0x3498DB);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 🎫 New Ticket — #${String(ticket.ticket_number).padStart(4, '0')}`
        )
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    const lines = [
        `${category.emoji} **Category:** ${category.label}`,
        `📝 **Title:** ${ticket.title}`,
        `${PRIORITY_LABELS[ticket.priority] || '🟡 Medium'} Priority`,
        `👤 **From:** <@${ticket.user_id}>`,
        `📅 **Opened:** <t:${Math.floor(new Date(ticket.created_at).getTime() / 1000)}:R>`,
        '',
        `📌 **Channel:** <#${ticket.channel_id}>`,
    ];

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(lines.join('\n'))
    );

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`ticket_jump_${ticket.channel_id}`)
            .setLabel('Go to Ticket')
            .setEmoji('📌')
            .setStyle(ButtonStyle.Primary)
    );

    container.addActionRowComponents(buttonRow);

    return container;
}

// ═══════════════════════════════════════════
//  FEEDBACK PROMPT
// ═══════════════════════════════════════════

/**
 * Builds the post-close feedback prompt.
 * @param {number} ticketNumber
 * @returns {ContainerBuilder}
 */
export function buildFeedbackPrompt(ticketNumber) {
    const container = new ContainerBuilder()
        .setAccentColor(0x9B59B6);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 📝 Ticket #${String(ticketNumber).padStart(4, '0')} — Feedback`
        )
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            'Your ticket has been closed. How would you rate your experience?'
        )
    );

    const ratingRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_rate_1').setLabel('1').setEmoji('😞').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket_rate_2').setLabel('2').setEmoji('😐').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket_rate_3').setLabel('3').setEmoji('🙂').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket_rate_4').setLabel('4').setEmoji('😊').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket_rate_5').setLabel('5').setEmoji('🤩').setStyle(ButtonStyle.Secondary),
    );

    container.addActionRowComponents(ratingRow);

    return container;
}

// ═══════════════════════════════════════════
//  PRIORITY SELECT (used inside intake flow)
// ═══════════════════════════════════════════

/**
 * Builds a priority select menu as a Components V2 container.
 * @param {string} categoryKey - The category key to embed in the custom ID
 * @returns {ContainerBuilder}
 */
export function buildPrioritySelect(categoryKey) {
    const container = new ContainerBuilder()
        .setAccentColor(0xF1C40F);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('### ⚡ Select Priority')
    );

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`ticket_priority_${categoryKey}`)
            .setPlaceholder('Choose priority level...')
            .addOptions(
                { label: 'Low', value: 'low', emoji: '🟢', description: 'Non-urgent, can wait' },
                { label: 'Medium', value: 'medium', emoji: '🟡', description: 'Normal priority', default: true },
                { label: 'High', value: 'high', emoji: '🟠', description: 'Needs attention soon' },
                { label: 'Urgent', value: 'urgent', emoji: '🔴', description: 'Critical — needs immediate help' },
            )
    );

    container.addActionRowComponents(selectRow);

    return container;
}

// ═══════════════════════════════════════════
//  CLOSE CONFIRMATION
// ═══════════════════════════════════════════

/**
 * Builds the resolve/close confirmation prompt.
 * @returns {ContainerBuilder}
 */
export function buildResolveConfirmation() {
    const container = new ContainerBuilder()
        .setAccentColor(0x2ECC71);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            '### ✅ Ticket Resolved\nHas your issue been resolved?'
        )
    );

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Yes, Close Ticket')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('ticket_reopen')
            .setLabel('No, Reopen')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary),
    );

    container.addActionRowComponents(buttonRow);

    return container;
}

// ═══════════════════════════════════════════
//  CLOSE LOG (sent to log channel)
// ═══════════════════════════════════════════

/**
 * Builds the Components V2 close log card sent to the log channel.
 * @param {object} ticket - Ticket record
 * @param {object} category - Category info
 * @param {string|null} reason - Close reason
 * @param {string} transcript - Formatted conversation transcript
 * @returns {ContainerBuilder}
 */
export function buildCloseLog(ticket, category, reason, transcript) {
    const container = new ContainerBuilder()
        .setAccentColor(0x95A5A6);

    // Header
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# 📋 Ticket #${String(ticket.ticket_number).padStart(4, '0')} — Closed`
        )
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    // Ticket details
    const detailLines = [
        `${category.emoji} **Category:** ${category.label}`,
        `📝 **Title:** ${ticket.title}`,
        `👤 **Opened by:** <@${ticket.user_id}>`,
        `🛡️ **Assigned to:** ${ticket.staff_id ? `<@${ticket.staff_id}>` : 'Unassigned'}`,
        `📅 **Opened:** <t:${Math.floor(new Date(ticket.created_at).getTime() / 1000)}:f>`,
        `🔒 **Closed:** <t:${Math.floor(Date.now() / 1000)}:f>`,
    ];
    if (reason) detailLines.push(`📄 **Reason:** ${reason}`);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(detailLines.join('\n'))
    );

    // Transcript
    if (transcript && transcript.length > 0) {
        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        );
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent('### 💬 Transcript')
        );
        // Discord has a 4096 char limit per TextDisplay, truncate if needed
        const truncated = transcript.length > 3800
            ? transcript.substring(0, 3800) + '\n\n*... transcript truncated ...*'
            : transcript;
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(truncated)
        );
    }

    return container;
}
