import { ChannelType, PermissionFlagsBits, MessageFlags } from 'discord.js';
import {
    getConfig, getCategories, getNextTicketNumber,
    createTicket, getTicketByChannel, updateTicket,
    countUserOpenTickets, saveFeedback,
} from './db.js';
import {
    buildIntakeModal, buildTicketCard, buildStaffNotification,
    buildFeedbackPrompt, buildResolveConfirmation, buildCloseLog,
} from './ui.js';

// ═══════════════════════════════════════════
//  TICKET CREATION: Category Select → Modal → Channel
// ═══════════════════════════════════════════

/**
 * Handles when a user selects a category from the dropdown on the ticket panel.
 * Opens the intake modal.
 */
export async function handleCategorySelect(interaction) {
    const categoryKey = interaction.values[0];
    const guildId = interaction.guildId;

    const config = await getConfig(guildId);
    const categories = await getCategories(guildId);
    const category = categories.find(c => c.key === categoryKey);

    if (!category) {
        return interaction.reply({
            content: '❌ This ticket category no longer exists.',
            flags: MessageFlags.Ephemeral,
        });
    }

    // Check max tickets per user
    const maxTickets = config?.max_tickets_per_user ?? 3;
    const openCount = await countUserOpenTickets(guildId, interaction.user.id);
    if (openCount >= maxTickets) {
        return interaction.reply({
            content: `❌ You already have **${openCount}** open ticket(s). Maximum is **${maxTickets}**. Please close a ticket first.`,
            flags: MessageFlags.Ephemeral,
        });
    }

    const modal = buildIntakeModal(category);
    await interaction.showModal(modal);
}

/**
 * Handles modal submission — creates the ticket channel and posts the card.
 */
export async function handleModalSubmit(interaction, client) {
    const categoryKey = interaction.customId.replace('ticket_modal_', '');
    const guildId = interaction.guildId;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const config = await getConfig(guildId);
    const categories = await getCategories(guildId);
    const category = categories.find(c => c.key === categoryKey);

    if (!config || !config.category_id || !config.staff_role_id) {
        return interaction.editReply({
            content: '❌ Ticketing system is not fully configured. Please ask an admin to run `/ticket-config`.',
        });
    }

    // Get form values
    const title = interaction.fields.getTextInputValue('ticket_title');
    const description = interaction.fields.getTextInputValue('ticket_description');

    // Get next ticket number
    const ticketNumber = await getNextTicketNumber(guildId);
    const channelName = `ticket-${String(ticketNumber).padStart(4, '0')}-${interaction.user.username}`.substring(0, 100);

    // Create private channel
    let ticketChannel;
    try {
        ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: config.category_id,
            permissionOverwrites: [
                {
                    id: interaction.guild.id, // @everyone
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: interaction.user.id, // Ticket creator
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                    ],
                },
                {
                    id: config.staff_role_id, // Staff role
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.ManageMessages,
                    ],
                },
                {
                    id: client.user.id, // Bot
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ManageChannels,
                        PermissionFlagsBits.ReadMessageHistory,
                    ],
                },
            ],
        });
    } catch (err) {
        console.error('[Tickets] Error creating channel:', err);
        return interaction.editReply({
            content: '❌ Failed to create ticket channel. Please check bot permissions.',
        });
    }

    // Create ticket record in DB
    const ticketData = {
        ticket_number: ticketNumber,
        guild_id: guildId,
        channel_id: ticketChannel.id,
        user_id: interaction.user.id,
        category: categoryKey,
        title,
        description,
        priority: 'medium', // Default, user can change via interaction later
        status: 'open',
        created_at: new Date().toISOString(),
    };

    const ticket = await createTicket(ticketData);

    // Post the ticket card in the channel
    const card = buildTicketCard(ticket, category);
    const cardMessage = await ticketChannel.send({
        components: [card],
        flags: MessageFlags.IsComponentsV2,
    });

    // Update ticket with the card message ID (for in-place updates)
    await updateTicket(ticket.id, { card_message_id: cardMessage.id });

    // Send welcome ping
    await ticketChannel.send({
        content: `Hey <@${interaction.user.id}>, your ticket has been created! A staff member will be with you shortly.`,
    });

    // Notify staff channel
    if (config.staff_channel_id) {
        try {
            const staffChannel = await client.channels.fetch(config.staff_channel_id);
            if (staffChannel) {
                const notification = buildStaffNotification(ticket, category);
                await staffChannel.send({
                    content: `<@&${config.staff_role_id}>`,
                });
                await staffChannel.send({
                    components: [notification],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        } catch (err) {
            console.error('[Tickets] Error notifying staff:', err);
        }
    }

    // Reply to the user
    return interaction.editReply({
        content: `✅ Ticket created! Head over to <#${ticketChannel.id}>`,
    });
}

// ═══════════════════════════════════════════
//  TICKET LIFECYCLE: Claim, Resolve, Reopen, Close
// ═══════════════════════════════════════════

/**
 * Staff claims a ticket.
 */
export async function handleClaimTicket(interaction, client) {
    const ticket = await getTicketByChannel(interaction.channelId);
    if (!ticket) return interaction.reply({ content: '❌ This is not a ticket channel.', flags: MessageFlags.Ephemeral });

    const config = await getConfig(interaction.guildId);
    const member = interaction.member;

    // Verify staff role
    if (!member.roles.cache.has(config?.staff_role_id)) {
        return interaction.reply({ content: '❌ You don\'t have the staff role to claim tickets.', flags: MessageFlags.Ephemeral });
    }

    if (ticket.status !== 'open') {
        return interaction.reply({ content: '❌ This ticket has already been claimed.', flags: MessageFlags.Ephemeral });
    }

    // Update ticket
    const updated = await updateTicket(ticket.id, {
        status: 'claimed',
        staff_id: interaction.user.id,
        claimed_at: new Date().toISOString(),
    });

    // Update the card in-place
    await refreshTicketCard(interaction, updated, client);

    return interaction.reply({
        content: `🙋 <@${interaction.user.id}> claimed this ticket.`,
    });
}

/**
 * Staff resolves a ticket — asks user for confirmation.
 */
export async function handleResolveTicket(interaction, client) {
    const ticket = await getTicketByChannel(interaction.channelId);
    if (!ticket) return interaction.reply({ content: '❌ This is not a ticket channel.', flags: MessageFlags.Ephemeral });

    // Update status
    const updated = await updateTicket(ticket.id, {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
    });

    // Update the card
    await refreshTicketCard(interaction, updated, client);

    // Send confirmation prompt to user
    const confirmation = buildResolveConfirmation();
    await interaction.reply({
        content: `<@${ticket.user_id}> Your ticket has been marked as resolved. Please confirm below:`,
    });
    await interaction.channel.send({
        components: [confirmation],
        flags: MessageFlags.IsComponentsV2,
    });
}

/**
 * Reopen a resolved ticket.
 */
export async function handleReopenTicket(interaction, client) {
    const ticket = await getTicketByChannel(interaction.channelId);
    if (!ticket) return interaction.reply({ content: '❌ This is not a ticket channel.', flags: MessageFlags.Ephemeral });

    const updated = await updateTicket(ticket.id, {
        status: ticket.staff_id ? 'claimed' : 'open',
        resolved_at: null,
    });

    await refreshTicketCard(interaction, updated, client);

    return interaction.reply({
        content: '🔄 Ticket has been reopened.',
    });
}

/**
 * Close a ticket — delete channel, send feedback, log transcript.
 */
export async function handleCloseTicket(interaction, client, reason = null) {
    // Defer immediately to prevent interaction timeout
    await interaction.deferReply();

    const ticket = await getTicketByChannel(interaction.channelId);
    if (!ticket) return interaction.editReply({ content: '❌ This is not a ticket channel.' });

    const config = await getConfig(interaction.guildId);
    const categories = await getCategories(interaction.guildId);
    const category = categories.find(c => c.key === ticket.category) || { emoji: '🎫', label: 'Ticket', color: '#808080' };

    // Update ticket to closed
    await updateTicket(ticket.id, {
        status: 'closed',
        closed_at: new Date().toISOString(),
    });

    // Collect transcript from channel before deletion
    let transcript = '';
    try {
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const sorted = [...messages.values()].reverse(); // oldest first
        transcript = sorted
            .filter(m => !m.author.bot || m.author.id === client.user.id) // include bot messages too for context
            .map(m => {
                const time = `<t:${Math.floor(m.createdTimestamp / 1000)}:t>`;
                const author = m.author.bot ? `🤖 ${m.author.username}` : m.author.username;
                const content = m.content || '*[component/embed]*';
                return `${time} **${author}:** ${content}`;
            })
            .join('\n');
    } catch (err) {
        console.error('[Tickets] Error collecting transcript:', err);
        transcript = '*Could not collect transcript.*';
    }

    // Log to transcript channel as Components V2
    if (config?.log_channel_id) {
        try {
            const logChannel = await client.channels.fetch(config.log_channel_id);
            if (logChannel) {
                const closeLog = buildCloseLog(ticket, category, reason, transcript);
                await logChannel.send({
                    components: [closeLog],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        } catch (err) {
            console.error('[Tickets] Error logging transcript:', err);
        }
    }

    // Send feedback DM to user
    try {
        const user = await client.users.fetch(ticket.user_id);
        if (user) {
            const feedback = buildFeedbackPrompt(ticket.ticket_number);
            await user.send({
                components: [feedback],
                flags: MessageFlags.IsComponentsV2,
            });
        }
    } catch (err) {
        // User might have DMs disabled, that's fine
        console.log('[Tickets] Could not send feedback DM (DMs may be disabled).');
    }

    // Notify in channel before deletion
    await interaction.editReply({
        content: '🔒 This ticket has been closed. Channel will be deleted in 5 seconds...',
    });

    // Save channel ref before timeout
    const ticketChannel = interaction.channel;

    // Delete channel after short delay
    setTimeout(async () => {
        try {
            await ticketChannel.delete();
        } catch (err) {
            console.error('[Tickets] Error deleting channel:', err);
        }
    }, 5000);
}

// ═══════════════════════════════════════════
//  FEEDBACK
// ═══════════════════════════════════════════

/**
 * Handles feedback rating button clicks (from DM).
 */
export async function handleFeedbackRating(interaction) {
    const rating = parseInt(interaction.customId.replace('ticket_rate_', ''));

    // Find the most recently closed ticket for this user
    // (The feedback DM doesn't carry the ticket ID, so we find by user)
    const { supabase } = await import('../../lib/supabase.js');
    const { data: ticket } = await supabase
        .from('dcbot_tickets')
        .select('id, ticket_number')
        .eq('user_id', interaction.user.id)
        .eq('status', 'closed')
        .is('rating', null)
        .order('closed_at', { ascending: false })
        .limit(1)
        .single();

    if (!ticket) {
        return interaction.reply({
            content: '❌ Could not find a ticket to rate.',
            flags: MessageFlags.Ephemeral,
        });
    }

    await saveFeedback(ticket.id, rating, null);

    const emojis = ['', '😞', '😐', '🙂', '😊', '🤩'];

    // Must keep IsComponentsV2 flag — it can never be removed once set
    const { ContainerBuilder, TextDisplayBuilder } = await import('discord.js');
    const thankYou = new ContainerBuilder()
        .setAccentColor(0x2ECC71)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${emojis[rating]} Thanks for your feedback! You rated **${rating}/5**.`
            )
        );

    return interaction.update({
        components: [thankYou],
        flags: MessageFlags.IsComponentsV2,
    });
}

// ═══════════════════════════════════════════
//  JUMP BUTTON (Staff notification → ticket channel)
// ═══════════════════════════════════════════

/**
 * Handles the "Go to Ticket" button on staff notifications.
 */
export async function handleJumpButton(interaction) {
    const channelId = interaction.customId.replace('ticket_jump_', '');
    return interaction.reply({
        content: `📌 <#${channelId}>`,
        flags: MessageFlags.Ephemeral,
    });
}

// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════

/**
 * Refreshes the ticket card in-place by editing the original card message.
 */
async function refreshTicketCard(interaction, ticket, client) {
    const categories = await getCategories(interaction.guildId);
    const category = categories.find(c => c.key === ticket.category) || { emoji: '🎫', label: 'Ticket', color: '#808080' };

    if (ticket.card_message_id) {
        try {
            const channel = interaction.channel;
            const cardMessage = await channel.messages.fetch(ticket.card_message_id);
            const updatedCard = buildTicketCard(ticket, category);
            await cardMessage.edit({
                components: [updatedCard],
                flags: MessageFlags.IsComponentsV2,
            });
        } catch (err) {
            console.error('[Tickets] Error refreshing ticket card:', err);
        }
    }
}
