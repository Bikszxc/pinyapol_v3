import { MessageFlags } from 'discord.js';
import { getTrackedMods, updateModTimestamp } from '../../lib/supabase.js';
import { getWorkshopItemDetails } from '../../lib/steam.js';
import { buildUpdateNotification, buildWorkshopRestartNotice } from './ui.js';

/** @type {import('discord.js').Client} */
let client;

/**
 * Checks all tracked mods for Steam Workshop updates.
 */
async function checkForUpdates() {
    console.log('[WorkshopTracker] Checking for workshop updates...');
    try {
        const tracks = await getTrackedMods();
        if (!tracks || tracks.length === 0) return;

        const modIds = tracks.map(t => t.mod_id);
        const steamDetails = await getWorkshopItemDetails(modIds);

        for (const track of tracks) {
            const details = steamDetails.find(d => d.publishedfileid === track.mod_id);
            if (!details) continue;

            const lastUpdatedSteam = parseInt(details.time_updated);
            const lastUpdatedDb = parseInt(track.last_updated);

            if (lastUpdatedSteam > lastUpdatedDb) {
                console.log(`[WorkshopTracker] Update detected for mod: ${details.title}`);
                await notifyUpdate(track.channel_id, details);
                await notifyStatusChannelRestart(details);
                await updateModTimestamp(track.mod_id, lastUpdatedSteam);
            }
        }
    } catch (error) {
        console.error('[WorkshopTracker] Error in checkForUpdates loop:', error);
    }
}

/**
 * Sends a Components V2 notification for a mod update.
 */
async function notifyUpdate(channelId, details) {
    try {
        const container = buildUpdateNotification(details);

        const channel = await client.channels.fetch(channelId);
        if (!channel) return;

        await channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

        console.log(`[WorkshopTracker] Notified update for mod: ${details.title}`);
    } catch (error) {
        console.error('[WorkshopTracker] Error in notifyUpdate:', error);
    }
}

/**
 * Sends a restart warning notice to the status channel when a workshop mod update is detected.
 */
async function notifyStatusChannelRestart(details) {
    const statusChannelId = process.env.STATUS_CHANNEL_ID;
    if (!statusChannelId) return;

    try {
        const channel = await client.channels.fetch(statusChannelId);
        if (!channel) return;

        const container = buildWorkshopRestartNotice(details);

        await channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

        console.log(`[WorkshopTracker] Posted restart notice in status channel for mod: ${details.title}`);
    } catch (error) {
        console.error('[WorkshopTracker] Error posting status channel restart notice:', error);
    }
}


/**
 * Schedules workshop update checks aligned to clock boundaries (x:00, x:10, x:20, etc.)
 */
function scheduleAlignedCheck() {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const ms = now.getMilliseconds();

    const minutesToNext = 10 - (minutes % 10);
    const delay = (minutesToNext * 60 - seconds) * 1000 - ms;

    console.log(`[WorkshopTracker] Next aligned check in ${Math.round(delay / 1000)}s.`);

    setTimeout(async () => {
        await checkForUpdates();
        scheduleAlignedCheck();
    }, delay);
}

/**
 * Feature initializer — called by the loader.
 * @param {import('discord.js').Client} discordClient
 */
export function init(discordClient) {
    client = discordClient;

    // Run immediate initial check
    checkForUpdates();

    // Start clock-aligned 10-minute scheduler (x:00, x:10, x:20, ...)
    scheduleAlignedCheck();

    console.log('[WorkshopTracker] Initialized. Cron active for every 10 minutes on the clock (x:00, x:10, x:20...).');
}

