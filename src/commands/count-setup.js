import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import GuildConfig from '../models/GuildConfig.js';
import Counting from '../models/Counting.js';
import { createSuccessEmbed, createErrorEmbed } from '../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('count-setup')
    .setDescription('Manage counting channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a counting channel')
        .addChannelOption(option => option.setName('channel').setDescription('The channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a counting channel')
        .addChannelOption(option => option.setName('channel').setDescription('The channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel('channel');

    let config = await GuildConfig.findOne({ guildId: interaction.guildId });
    if (!config) config = new GuildConfig({ guildId: interaction.guildId });

    if (subcommand === 'add') {
      if (config.countingChannelIds.includes(channel.id)) {
        return interaction.reply({ embeds: [createErrorEmbed('This channel is already a counting channel.')], ephemeral: true });
      }
      config.countingChannelIds.push(channel.id);

      // Initialize Counting model
      await Counting.create({ guildId: interaction.guildId, channelId: channel.id });

      await config.save();
      return interaction.reply({ embeds: [createSuccessEmbed(`Added ${channel} to counting channels.`)] });

    } else if (subcommand === 'remove') {
      if (!config.countingChannelIds.includes(channel.id)) {
        return interaction.reply({ embeds: [createErrorEmbed('This channel is not a counting channel.')], ephemeral: true });
      }
      config.countingChannelIds = config.countingChannelIds.filter(id => id !== channel.id);

      await Counting.deleteOne({ guildId: interaction.guildId, channelId: channel.id });

      await config.save();
      return interaction.reply({ embeds: [createSuccessEmbed(`Removed ${channel} from counting channels.`)] });
    }
  }
};
