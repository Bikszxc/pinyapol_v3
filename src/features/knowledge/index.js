import { Events } from 'discord.js';
import { askCommand } from './commands/ask.js';
import { knowledgeCommand } from './commands/knowledge.js';
import { knowledgeConfigCommand } from './commands/knowledgeConfig.js';
import { handleKnowledgeConfigCommand } from './config.js';
import {
    handleAsk, handleContribute, handleContributeSubmit,
    handleUpload, handleUploadSubmit,
    handleReview, handleApprove, handleReject, handleSkip,
    handleSearch,
} from './handlers.js';

/**
 * Export slash commands for the loader to register.
 */
export const commands = [
    askCommand,
    knowledgeCommand,
    knowledgeConfigCommand,
];

/**
 * Feature initializer — called by the loader.
 * @param {import('discord.js').Client} client
 */
export function init(client) {

    client.on(Events.InteractionCreate, async (interaction) => {
        try {
            // ── Slash Commands ──
            if (interaction.isChatInputCommand()) {
                switch (interaction.commandName) {
                    case 'ask':
                        return handleAsk(interaction, client);
                    case 'knowledge': {
                        const sub = interaction.options.getSubcommand();
                        switch (sub) {
                            case 'contribute':
                                return handleContribute(interaction);
                            case 'upload':
                                return handleUpload(interaction);
                            case 'review':
                                return handleReview(interaction);
                            case 'search':
                                return handleSearch(interaction);
                            default:
                                return;
                        }
                    }
                    case 'knowledge-config':
                        return handleKnowledgeConfigCommand(interaction);
                    default:
                        return; // Not our command
                }
            }

            // ── Button Interactions ──
            if (interaction.isButton()) {
                const id = interaction.customId;

                if (id.startsWith('knowledge_approve_')) return handleApprove(interaction, client);
                if (id.startsWith('knowledge_reject_')) return handleReject(interaction, client);
                if (id === 'knowledge_skip') return handleSkip(interaction);
            }

            // ── Modal Submissions ──
            if (interaction.isModalSubmit()) {
                if (interaction.customId === 'knowledge_contribute_modal') {
                    return handleContributeSubmit(interaction, client);
                }
                if (interaction.customId === 'knowledge_upload_modal') {
                    return handleUploadSubmit(interaction, client);
                }
            }
        } catch (err) {
            console.error('[Knowledge] Interaction error:', err);

            const errorMsg = '❌ Something went wrong. Please try again.';
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMsg, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMsg, ephemeral: true });
                }
            } catch {
                // Can't respond
            }
        }
    });

    console.log('[Knowledge] Initialized. Listening for interactions.');
}
