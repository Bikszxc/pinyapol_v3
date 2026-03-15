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
