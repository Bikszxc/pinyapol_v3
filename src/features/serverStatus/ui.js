import {
    ContainerBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
} from 'discord.js';

/**
 * Returns styling info for a given server status.
 * @param {object} status - Server status object from getServerStatus()
 * @returns {{ emoji: string, accentColor: number, displayLabel: string }}
 */
export function getStatusStyling(status) {
    let emoji = '⚪';
    let accentColor = 0x808080; // Gray
    let displayLabel = status.label;

    if (status.state === 'running') {
        emoji = '🟢';
        accentColor = 0x2ECC71; // Green
        displayLabel = 'Server is Online';
    } else if (status.state === 'restarting_scheduled') {
        emoji = '⏳';
        accentColor = 0x9B59B6; // Purple
        displayLabel = `Scheduled ${status.type} Restart`;
    } else if (status.state === 'restarting_normal') {
        emoji = '🟠';
        accentColor = 0xE67E22; // Orange
        displayLabel = 'Server is Restarting';
    } else if (status.state === 'starting') {
        emoji = '🟡';
        accentColor = 0xF1C40F; // Yellow
        displayLabel = 'Server is Initializing';
    } else if (status.state === 'offline' || status.state === 'stopping') {
        emoji = '🔴';
        accentColor = 0xE74C3C; // Red
        displayLabel = 'Server is Offline';
    }

    return { emoji, accentColor, displayLabel };
}

/**
 * Returns the activity label string for the bot's presence.
 * @param {object} status - Server status object
 * @param {{ emoji: string, displayLabel: string }} styling - Output from getStatusStyling()
 * @returns {string}
 */
export function getActivityLabel(status, styling) {
    if (status.state === 'running') {
        return `🟢 Online | ${status.players} / ${status.maxPlayers} Players`;
    }
    if (status.state === 'restarting_scheduled') {
        return `⏳ Restarting | ${status.countdown.includes(':') ? 'Countdown' : status.label}`;
    }
    return `${styling.emoji} ${styling.displayLabel}`;
}

/**
 * Builds the Components V2 container for a server status notification.
 * @param {object} status - Server status object
 * @param {{ emoji: string, accentColor: number, displayLabel: string }} styling
 * @returns {ContainerBuilder}
 */
export function buildStatusMessage(status, styling) {
    const titleText = new TextDisplayBuilder()
        .setContent(`# ${styling.emoji} ${styling.displayLabel}`);

    const titleSeparator = new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small);

    const infoSeparator = new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small);

    const footerSeparator = new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small);

    const footerText = new TextDisplayBuilder()
        .setContent(`<t:${Math.floor(Date.now() / 1000)}:d> | <t:${Math.floor(Date.now() / 1000)}:t>`);

    // Assemble Container
    const container = new ContainerBuilder()
        .setAccentColor(styling.accentColor)
        .addTextDisplayComponents(titleText)
        .addSeparatorComponents(titleSeparator);

    // Add conditional info
    if (status.state === 'running') {
        const statsText = new TextDisplayBuilder().setContent([
            `### ${status.name}`,
            `👤 **Players:** \`${status.players} / ${status.maxPlayers}\``,
            `🗺️ **Map:** \`${status.map || 'Knox Country'}\``
        ].join('\n'));

        container
            .addTextDisplayComponents(statsText)
            .addSeparatorComponents(infoSeparator);
    } else if (status.state === 'restarting_scheduled' && status.countdown) {
        const countdownText = new TextDisplayBuilder()
            .setContent(`**Restarting:** ${status.countdown}\n**Triggered At:** ${status.trigger}`);

        container
            .addTextDisplayComponents(countdownText)
            .addSeparatorComponents(infoSeparator);
    } else {
        container.addSeparatorComponents(infoSeparator);
    }

    // Add Footer
    container
        .addSeparatorComponents(footerSeparator)
        .addTextDisplayComponents(footerText);

    return container;
}
