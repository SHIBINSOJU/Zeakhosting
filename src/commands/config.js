import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import GuildConfig from '../models/GuildConfig.js';
import { createInfoEmbed } from '../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Show current configuration')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('show').setDescription('Show config')),

  async execute(interaction) {
    const config = await GuildConfig.findOne({ guildId: interaction.guildId });
    if (!config) return interaction.reply({ content: 'No configuration found.', ephemeral: true });

    const embed = createInfoEmbed('Guild Configuration', `Settings for ${interaction.guild.name}`)
      .addFields(
        { name: 'Staff Roles', value: config.staffRoleIds.map(id => `<@&${id}>`).join(', ') || 'None', inline: false },
        { name: 'Ticket Categories', value: Object.entries(config.ticketCategories).map(([k, v]) => `**${k}**: ${v ? `<#${v}>` : 'Not Set'}`).join('\n'), inline: false },
        { name: 'Ticket Log Channel', value: config.ticketLogChannelId ? `<#${config.ticketLogChannelId}>` : 'Not Set', inline: true },
        { name: 'Counting Channels', value: config.countingChannelIds.map(id => `<#${id}>`).join(', ') || 'None', inline: false }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
