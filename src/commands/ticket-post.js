import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createInfoEmbed } from '../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket-post')
    .setDescription('Post the ticket creation panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to post the panel in')
        .setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    const embed = createInfoEmbed('Create a Ticket', 'Click the button below that matches your inquiry to open a ticket.')
      .addFields({ name: 'Options', value: '• Support\n• Issues\n• Partnership\n• Other' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('ticket_create_support').setLabel('Support').setStyle(ButtonStyle.Primary).setEmoji('🛠️'),
        new ButtonBuilder().setCustomId('ticket_create_issues').setLabel('Issues').setStyle(ButtonStyle.Danger).setEmoji('🐛'),
        new ButtonBuilder().setCustomId('ticket_create_partnership').setLabel('Partnership').setStyle(ButtonStyle.Success).setEmoji('🤝'),
        new ButtonBuilder().setCustomId('ticket_create_other').setLabel('Other').setStyle(ButtonStyle.Secondary).setEmoji('❓')
      );

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `Ticket panel posted in ${channel}.`, ephemeral: true });
  }
};
