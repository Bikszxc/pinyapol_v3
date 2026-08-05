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
 * Set to empty array to disable knowledge / RAG commands.
 */
export const commands = [];

/**
 * Feature initializer — called by the loader.
 * Disabled: RAG / Knowledge feature is turned off.
 * @param {import('discord.js').Client} client
 */
export function init(client) {
    console.log('[Knowledge] Feature disabled.');
    return;
}

