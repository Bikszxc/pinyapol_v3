import {
    ContainerBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
    ThumbnailBuilder,
} from 'discord.js';

/**
 * Builds the Components V2 container for a workshop mod update notification.
 * @param {object} details - Steam Workshop item details
 * @returns {ContainerBuilder}
 */
export function buildUpdateNotification(details) {
    const button = new ButtonBuilder()
        .setLabel('View on Workshop')
        .setURL(`https://steamcommunity.com/sharedfiles/filedetails/?id=${details.publishedfileid}`)
        .setStyle(ButtonStyle.Link);

    const actionRow = new ActionRowBuilder()
        .addComponents(button);

    const titleText = new TextDisplayBuilder()
        .setContent(`## 🛠️ Workshop Update Detected!`);

    const descriptionText = new TextDisplayBuilder()
        .setContent(`**Mod Name:** ${details.title}\n**Mod ID:** \`${details.publishedfileid}\`\n\n${details.description.substring(0, 300)}...`);

    const mentionText = new TextDisplayBuilder()
        .setContent(`<@&${process.env.ROLE_ID}>`);

    const thumbnail = new ThumbnailBuilder()
        .setURL(details.preview_url);

    const section = new SectionBuilder()
        .addTextDisplayComponents(descriptionText)
        .setThumbnailAccessory(thumbnail);

    const separator = new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Large);

    const container = new ContainerBuilder()
        .setAccentColor(0xFED405)
        .addTextDisplayComponents(titleText)
        .addSectionComponents(section)
        .addSeparatorComponents(separator)
        .addTextDisplayComponents(mentionText)
        .addActionRowComponents(actionRow);

    return container;
}

/**
 * Builds a Components V2 container for the status channel when a workshop update requires a restart warning.
 * @param {object} details - Steam Workshop item details
 * @returns {ContainerBuilder}
 */
export function buildWorkshopRestartNotice(details) {
    const titleText = new TextDisplayBuilder()
        .setContent(`# ⚠️ Workshop Mod Update Detected`);

    const titleSeparator = new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small);

    const bodyText = new TextDisplayBuilder()
        .setContent([
            `A Steam Workshop mod update was detected for **${details.title}** (\`${details.publishedfileid}\`).`,
            ``,
            `⏳ **The server is scheduled / ongoing countdown to restart soon.**`,
            `🚫 **Please refrain from joining the server at the moment.**`
        ].join('\n'));

    const infoSeparator = new SeparatorBuilder()
        .setDivider(false)
        .setSpacing(SeparatorSpacingSize.Small);

    const button = new ButtonBuilder()
        .setLabel('View Mod on Workshop')
        .setURL(`https://steamcommunity.com/sharedfiles/filedetails/?id=${details.publishedfileid}`)
        .setStyle(ButtonStyle.Link);

    const actionRow = new ActionRowBuilder()
        .addComponents(button);

    const container = new ContainerBuilder()
        .setAccentColor(0xE67E22) // Orange Warning Accent
        .addTextDisplayComponents(titleText)
        .addSeparatorComponents(titleSeparator)
        .addTextDisplayComponents(bodyText)
        .addSeparatorComponents(infoSeparator)
        .addActionRowComponents(actionRow);

    return container;
}

