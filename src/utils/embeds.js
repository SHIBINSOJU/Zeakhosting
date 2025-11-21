import { EmbedBuilder } from 'discord.js';

const footerText = "© ShotDevs";

export const createEmbed = (color, title, description) => {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: footerText });
};

export const createSuccessEmbed = (description) => {
  return createEmbed('#00FF00', 'Success', description);
};

export const createErrorEmbed = (description) => {
  return createEmbed('#FF0000', 'Error', description);
};

export const createInfoEmbed = (title, description) => {
  return createEmbed('#0099FF', title, description);
};
