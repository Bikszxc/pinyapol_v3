import { MessageFlags, ActivityType } from 'discord.js';
import { getServerStatus } from '../../lib/status.js';
import { PteroSocket } from '../../lib/pteroSocket.js';
import { getStatusStyling, getActivityLabel, buildStatusMessage } from './ui.js';

/** @type {import('discord.js').Client} */
let client;

/** Tracks the last status key to detect state changes */
let lastStatusKey = null;

/** Concurrency guard to prevent overlapping checks */
let isChecking = false;

/**
 * Checks the server status and sends a notification if the state changed.
 * @param {boolean} silent - If true, initializes state without sending a notification.
 * @returns {Promise<object|null>} The status object, or null on error.
 */
async function updateServerStatus(silent = false) {
    console.log('[ServerStatus] Checking for server status changes...');
    try {
        const status = await getServerStatus();
        const channelId = process.env.STATUS_CHANNEL_ID;

        if (!channelId) {
            console.warn('[ServerStatus] STATUS_CHANNEL_ID not set, skipping status check.');
            return;
        }

        const styling = getStatusStyling(status);

        // Update Bot Activity (Always update this to reflect player counts)
        const activityLabel = getActivityLabel(status, styling);
        client.user.setActivity(activityLabel, { type: ActivityType.Custom });

        // Generate a unique key for the current state to detect changes
        let currentKey = status.state;
        if (status.state === 'restarting_scheduled') {
            // Stable ID: Bucket the trigger time to the nearest 10 minutes.
            // This prevents "Double Countdowns" when Ptero updates last_run_at during the reboot.
            const triggerUnix = status.trigger.match(/<t:(\d+):T>/)?.[1] || Math.floor(Date.now() / 1000);
            const bucketedTrigger = Math.floor(triggerUnix / 600) * 600; // 10 min buckets
            currentKey = `${status.state}_${status.type}_${bucketedTrigger}`;

            // PRECISION TIMING: If we have a countdown, schedule an immediate check when it hits 0.
            if (status.countdown.includes('<t:')) {
                const targetUnix = status.countdown.match(/<t:(\d+):R>/)?.[1];
                if (targetUnix) {
                    const msUntilZero = (parseInt(targetUnix) * 1000) - Date.now();
                    if (msUntilZero > 0 && msUntilZero < 600000) { // Only if within 10 mins
                        console.log(`[ServerStatus] Scheduling precision check in ${Math.round(msUntilZero / 1000)}s for countdown finish.`);
                        setTimeout(() => {
                            isChecking = false; // Reset to allow the forced check
                            triggerStatusCheck();
                        }, msUntilZero + 2000); // 2s buffer for safety
                    }
                }
            }
        }

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
        if (!channel) return;

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
 * Triggers a status check with concurrency guard and transitional-state retry logic.
 */
async function triggerStatusCheck() {
    if (isChecking) return;
    isChecking = true;

    try {
        const status = await updateServerStatus();
        if (!status) {
            isChecking = false;
            return;
        }

        // If the server is in a "transitional" state (starting or running but not yet queryable)
        // We should check again soon to detect when it's fully online.
        if (status.state === 'starting' || status.label === 'Offline') {
            const pteroState = status.pteroState;
            if (pteroState === 'starting' || pteroState === 'running') {
                console.log(`[ServerStatus] Server is ${status.label}. Checking again in 20s...`);
                setTimeout(() => {
                    isChecking = false;
                    triggerStatusCheck();
                }, 20000);
                return;
            }
        }
    } catch (err) {
        console.error('[ServerStatus] Error in triggerStatusCheck:', err);
    }

    isChecking = false;
}

/**
 * Feature initializer — called by the loader.
 * @param {import('discord.js').Client} discordClient
 */
export function init(discordClient) {
    client = discordClient;

    // Initial silent check (initialize state without sending notification)
    updateServerStatus(true);

    // --- WebSocket Setup (Real-time) ---
    const socket = new PteroSocket();

    socket.on('status', (newStatus) => {
        console.log(`[ServerStatus] [WebSocket] Triggering status update due to power state: ${newStatus}`);
        triggerStatusCheck();
    });

    socket.on('console', (output) => {
        const lowerOutput = output.toLowerCase();
        // Check for restart keywords to trigger immediate schedule detection
        if (lowerOutput.includes('restart') || lowerOutput.includes('reboot') || lowerOutput.includes('shutting down')) {
            console.log(`[ServerStatus] [WebSocket] Detected restart keyword in console: "${output.trim()}". Triggering check...`);
            triggerStatusCheck();
        }

        // Check for "Economy hooks attached" to trigger "Online" status faster
        if (output.includes('[StatsCollector] Economy hooks attached.')) {
            console.log(`[ServerStatus] [WebSocket] Server initialization pattern detected. Triggering "Online" check in 15s...`);
            setTimeout(() => {
                isChecking = false; // Ensure we don't get blocked by an existing check
                triggerStatusCheck();
            }, 15000);
        }
    });

    socket.connect();

    // Heartbeat Polling (Backup - every 20 seconds)
    setInterval(updateServerStatus, 20000);

    console.log('[ServerStatus] Initialized. Real-time WebSocket + 20s heartbeat polling active.');
}
