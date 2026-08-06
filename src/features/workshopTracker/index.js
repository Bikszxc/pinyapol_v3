import { MessageFlags, Events } from 'discord.js';
import { getTrackedMods, updateModTimestamp } from '../../lib/supabase.js';
import { getWorkshopItemDetails } from '../../lib/steam.js';
import { buildUpdateNotification, buildWorkshopRestartNotice } from './ui.js';
import { syncModsCommand } from './commands/syncMods.js';

export const commands = [syncModsCommand];

/** @type {import('discord.js').Client} */
let client;

/**
 * Silently synchronizes all tracked mods' timestamps with Steam without sending Discord notifications.
 * @returns {Promise<{ total: number, updated: number }>}
 */
export async function syncModsSilent() {
    console.log('[WorkshopTracker] Silent force sync started...');
    try {
        const tracks = await getTrackedMods();
        if (!tracks || tracks.length === 0) {
            console.log('[WorkshopTracker] No tracked mods found.');
            return { total: 0, updated: 0 };
        }

        const modIds = tracks.map(t => t.mod_id);
        const steamDetails = await getWorkshopItemDetails(modIds);

        let updatedCount = 0;
        for (const track of tracks) {
            const details = steamDetails.find(d => d.publishedfileid === track.mod_id);
            if (!details || !details.time_updated) {
                console.warn(`[WorkshopTracker] Missing details or time_updated for mod_id: ${track.mod_id}`);
                continue;
            }

            const lastUpdatedSteam = parseInt(details.time_updated);
            if (isNaN(lastUpdatedSteam)) {
                console.warn(`[WorkshopTracker] Invalid time_updated for mod_id: ${track.mod_id}`);
                continue;
            }

            await updateModTimestamp(track.mod_id, lastUpdatedSteam);
            updatedCount++;
        }

        console.log(`[WorkshopTracker] Silent sync completed. Updated ${updatedCount}/${tracks.length} mods.`);
        return { total: tracks.length, updated: updatedCount };
    } catch (error) {
        console.error('[WorkshopTracker] Error during silent force sync:', error);
        throw error;
    }
}

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
            if (!details || !details.time_updated) continue;

            const lastUpdatedSteam = parseInt(details.time_updated);
            if (isNaN(lastUpdatedSteam)) continue;

            const lastUpdatedDb = parseInt(track.last_updated) || 0;

            if (lastUpdatedSteam > lastUpdatedDb) {
                console.log(`[WorkshopTracker] Update detected for mod: ${details.title || track.mod_id}`);
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

    discordClient.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'workshop-sync') {
            await interaction.deferReply({ ephemeral: true });
            try {
                const result = await syncModsSilent();
                await interaction.editReply(`✅ Force sync complete. Updated **${result.updated}/${result.total}** mod(s) in the database without sending notifications.`);
            } catch (err) {
                console.error('[WorkshopTracker] Command error:', err);
                await interaction.editReply(`❌ Failed to force sync mods: ${err.message}`);
            }
        }
    });

    // Run immediate initial check
    checkForUpdates();

    // Start clock-aligned 10-minute scheduler (x:00, x:10, x:20, ...)
    scheduleAlignedCheck();

    console.log('[WorkshopTracker] Initialized. Cron active for every 10 minutes on the clock (x:00, x:10, x:20...).');
}


