import {
    ContainerBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
} from 'discord.js';

/**
 * Returns styling info for a given server status.
 * @param {object} status - Server status object from getServerStatus()
 * @returns {{ emoji: string, accentColor: number, displayLabel: string }}
 */
export function getStatusStyling(status) {
    let emoji = '🔴';
    let accentColor = 0xE74C3C; // Red
    let displayLabel = 'Server is Offline';

    if (status.state === 'running') {
        emoji = '🟢';
        accentColor = 0x2ECC71; // Green
        displayLabel = 'Server is Online';
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
    return `${styling.emoji} ${styling.displayLabel}`;
}

/**
 * Builds the Components V2 container for a server status notification.
 * @param {object} status - Server status object
 * @param {{ emoji: string, accentColor: number, displayLabel: string }} styling
 * @returns {ContainerBuilder}
 */
export function buildStatusMessage(status, styling) {
    const ip = process.env.PZ_SERVER_IP || '188.72.197.193';
    const port = process.env.PZ_SERVER_PORT || '26945';

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
            `🌐 **IP:** \`${ip}\``,
            `🔌 **Port:** \`${port}\``,
            `👤 **Players:** \`${status.players} / ${status.maxPlayers}\``,
            `🗺️ **Map:** \`${status.map || 'Knox Country'}\``
        ].join('\n'));

        const copyIpButton = new ButtonBuilder()
            .setCustomId('status_copy_ip')
            .setLabel('Copy IP')
            .setEmoji('🌐')
            .setStyle(ButtonStyle.Secondary);

        const copyPortButton = new ButtonBuilder()
            .setCustomId('status_copy_port')
            .setLabel('Copy Port')
            .setEmoji('🔌')
            .setStyle(ButtonStyle.Secondary);

        const actionRow = new ActionRowBuilder()
            .addComponents(copyIpButton, copyPortButton);

        container
            .addTextDisplayComponents(statsText)
            .addSeparatorComponents(infoSeparator)
            .addActionRowComponents(actionRow);
    } else {
        container.addSeparatorComponents(infoSeparator);
    }

    // Add Footer
    container
        .addSeparatorComponents(footerSeparator)
        .addTextDisplayComponents(footerText);

    return container;
}
