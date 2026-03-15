import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { REST, Routes } from 'discord.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FEATURES_DIR = join(__dirname, '..', 'features');

/**
 * Dynamically discovers and initializes all feature modules.
 * Each feature must export an `init(client)` function from its index.js.
 * Features may also export a `commands` array of SlashCommandBuilder objects.
 */
export async function loadFeatures(client) {
    console.log('[Loader] Scanning for features...');

    let featureDirs;
    try {
        featureDirs = await readdir(FEATURES_DIR, { withFileTypes: true });
    } catch (err) {
        console.error('[Loader] Could not read features directory:', err.message);
        return;
    }

    const folders = featureDirs.filter(d => d.isDirectory());
    const allCommands = [];

    for (const folder of folders) {
        const featurePath = join(FEATURES_DIR, folder.name, 'index.js');
        try {
            const feature = await import(`file://${featurePath}`);

            if (typeof feature.init !== 'function') {
                console.warn(`[Loader] Skipping "${folder.name}" — no init() export found.`);
                continue;
            }

            await feature.init(client);
            console.log(`[Loader] ✅ Loaded feature: ${folder.name}`);

            // Collect slash commands if the feature exports them
            if (Array.isArray(feature.commands)) {
                allCommands.push(...feature.commands);
                console.log(`[Loader]    └─ ${feature.commands.length} command(s) registered from ${folder.name}`);
            }
        } catch (err) {
            console.error(`[Loader] ❌ Failed to load feature "${folder.name}":`, err);
        }
    }

    // Register all collected slash commands with Discord
    if (allCommands.length > 0) {
        await registerCommands(allCommands);
    }

    console.log('[Loader] All features loaded.');
}

/**
 * Registers all slash commands with Discord's API.
 */
async function registerCommands(commands) {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const commandData = commands.map(c => c.toJSON());

    try {
        console.log(`[Loader] Registering ${commandData.length} slash command(s)...`);

        if (process.env.GUILD_ID) {
            // Guild commands (instant, good for development)
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commandData }
            );
            console.log(`[Loader] ✅ Registered ${commandData.length} guild command(s).`);
        } else {
            // Global commands (can take up to 1 hour to propagate)
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commandData }
            );
            console.log(`[Loader] ✅ Registered ${commandData.length} global command(s).`);
        }
    } catch (err) {
        console.error('[Loader] ❌ Failed to register commands:', err);
    }
}
