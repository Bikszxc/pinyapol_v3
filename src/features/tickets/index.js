import { Events } from 'discord.js';
import { ticketConfigCommand } from './commands/ticketConfig.js';
import { ticketSetupCommand } from './commands/ticketSetup.js';
import { ticketCloseCommand } from './commands/ticketClose.js';
import { handleConfigCommand, handleSetupCommand } from './config.js';
import {
    handleCategorySelect, handleModalSubmit,
    handleClaimTicket, handleResolveTicket,
    handleReopenTicket, handleCloseTicket,
    handleFeedbackRating, handleJumpButton,
} from './handlers.js';

/**
 * Export slash commands for the loader to register.
 */
export const commands = [
    ticketConfigCommand,
    ticketSetupCommand,
    ticketCloseCommand,
];

/**
 * Feature initializer — called by the loader.
 * Sets up all interaction listeners for the ticketing system.
 * @param {import('discord.js').Client} client
 */
export function init(client) {

    client.on(Events.InteractionCreate, async (interaction) => {
        try {
            // ── Slash Commands ──
            if (interaction.isChatInputCommand()) {
                switch (interaction.commandName) {
                    case 'ticket-config':
                        return handleConfigCommand(interaction);
                    case 'ticket-setup':
                        return handleSetupCommand(interaction);
                    case 'ticket-close':
                        return handleCloseTicket(interaction, client, interaction.options.getString('reason'));
                    default:
                        return; // Not our command
                }
            }

            // ── Select Menu Interactions ──
            if (interaction.isStringSelectMenu()) {
                if (interaction.customId === 'ticket_category_select') {
                    return handleCategorySelect(interaction);
                }
            }

            // ── Button Interactions ──
            if (interaction.isButton()) {
                const id = interaction.customId;

                // Ticket lifecycle buttons
                if (id === 'ticket_claim') return handleClaimTicket(interaction, client);
                if (id === 'ticket_resolve') return handleResolveTicket(interaction, client);
                if (id === 'ticket_reopen') return handleReopenTicket(interaction, client);
                if (id === 'ticket_close') return handleCloseTicket(interaction, client);

                // Feedback rating
                if (id.startsWith('ticket_rate_')) return handleFeedbackRating(interaction);

                // Jump to ticket
                if (id.startsWith('ticket_jump_')) return handleJumpButton(interaction);
            }

            // ── Modal Submissions ──
            if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('ticket_modal_')) {
                    return handleModalSubmit(interaction, client);
                }
            }
        } catch (err) {
            console.error('[Tickets] Interaction error:', err);

            // Try to reply with an error if we haven't already
            const errorMsg = '❌ Something went wrong. Please try again.';
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMsg, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMsg, ephemeral: true });
                }
            } catch {
                // Can't respond, nothing we can do
            }
        }
    });

    console.log('[Tickets] Initialized. Listening for interactions.');
}
