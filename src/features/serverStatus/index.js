import { MessageFlags, ActivityType, Events } from 'discord.js';
import { getServerStatus } from '../../lib/status.js';
import { getStatusStyling, getActivityLabel, buildStatusMessage } from './ui.js';

/** @type {import('discord.js').Client} */
let client;

/** Tracks the last status key to detect state changes */
let lastStatusKey = null;

/** Counter for consecutive query failures to prevent false offline alerts */
let consecutiveFailures = 0;
const OFFLINE_THRESHOLD = 2; // Requires 2 consecutive polling checks (with internal retries) before declaring offline

/**
 * Checks the server status and sends a notification if the state changed.
 * @param {boolean} silent - If true, initializes state without sending a notification.
 * @returns {Promise<object|null>} The status object, or null on error.
 */
async function updateServerStatus(silent = false) {
    console.log('[ServerStatus] Checking for server status changes via GameDig...');
    try {
        const status = await getServerStatus();
        const channelId = process.env.STATUS_CHANNEL_ID;

        if (!channelId) {
            console.warn('[ServerStatus] STATUS_CHANNEL_ID not set, skipping status check.');
            return status;
        }

        const styling = getStatusStyling(status);

        // Update Bot Activity (Always update this to reflect player counts)
        const activityLabel = getActivityLabel(status, styling);
        client.user.setActivity(activityLabel, { type: ActivityType.Custom });

        if (status.state === 'offline') {
            consecutiveFailures++;
            if (consecutiveFailures < OFFLINE_THRESHOLD && lastStatusKey === 'running') {
                console.log(`[ServerStatus] Offline check failed (${consecutiveFailures}/${OFFLINE_THRESHOLD}). Suppressing false offline alert.`);
                return status;
            }
        } else {
            consecutiveFailures = 0;
        }

        // Generate a unique key for the current state to detect changes
        const currentKey = status.state;

        // Only send a new message if the state has changed
        if (currentKey === lastStatusKey) return status;

        lastStatusKey = currentKey;
        console.log(`[ServerStatus] State change detected: ${currentKey}. Sending notification...`);

        if (silent) {
            console.log('[ServerStatus] Silent mode: Status state initialized, skipping notification.');
            return status;
        }

        // Build and send the Components V2 message
        const container = buildStatusMessage(status, styling);

        const channel = await client.channels.fetch(channelId);
        if (!channel) return status;

        await channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

        return status;
    } catch (error) {
        console.error('[ServerStatus] Error in updateServerStatus:', error);
        return null;
    }
}

/**
 * Feature initializer — called by the loader.
 * @param {import('discord.js').Client} discordClient
 */
export function init(discordClient) {
    client = discordClient;

    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'status_copy_ip') {
            const ip = process.env.PZ_SERVER_IP || '188.72.197.193';
            await interaction.reply({
                content: `\`${ip}\``,
                ephemeral: true
            });
        } else if (interaction.customId === 'status_copy_port') {
            const port = process.env.PZ_SERVER_PORT || '26945';
            await interaction.reply({
                content: `\`${port}\``,
                ephemeral: true
            });
        }
    });

    // Initial silent check (initialize state without sending notification)
    updateServerStatus(true);

    // Heartbeat Polling (every 20 seconds)
    const intervalMs = parseInt(process.env.CHECK_INTERVAL_MS) || 20000;
    setInterval(updateServerStatus, intervalMs);

    console.log(`[ServerStatus] Initialized. GameDig polling active (${intervalMs}ms interval).`);
}
