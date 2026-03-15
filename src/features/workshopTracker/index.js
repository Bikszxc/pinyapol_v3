import { MessageFlags } from 'discord.js';
import { getTrackedMods, updateModTimestamp } from '../../lib/supabase.js';
import { getWorkshopItemDetails } from '../../lib/steam.js';
import { buildUpdateNotification } from './ui.js';

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
 * Feature initializer — called by the loader.
 * @param {import('discord.js').Client} discordClient
 */
export function init(discordClient) {
    client = discordClient;

    const interval = process.env.CHECK_INTERVAL_MS || 300000;
    setInterval(checkForUpdates, interval);

    // Initial check
    checkForUpdates();

    console.log(`[WorkshopTracker] Initialized. Polling every ${interval}ms.`);
}
