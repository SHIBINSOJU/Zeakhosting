import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import Counting from '../models/Counting.js';
import GuildConfig from '../models/GuildConfig.js';
import { createSuccessEmbed, createErrorEmbed } from '../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('count')
    .setDescription('Manage counting numbers')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Reset the count to 0')
    )
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set the count to a specific number')
        .addIntegerOption(option => option.setName('number').setDescription('The new number').setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    // Check if this is a counting channel
    const config = await GuildConfig.findOne({ guildId: interaction.guildId });
    if (!config || !config.countingChannelIds.includes(interaction.channelId)) {
      return interaction.reply({ embeds: [createErrorEmbed('This command can only be used in a configured counting channel.')], ephemeral: true });
    }

    const counting = await Counting.findOne({ guildId: interaction.guildId, channelId: interaction.channelId });
    if (!counting) return interaction.reply({ embeds: [createErrorEmbed('Counting data not found.')], ephemeral: true });

    if (subcommand === 'reset') {
      counting.lastNumber = 0;
      counting.lastUserId = null;
      counting.streak = 0;
      await counting.save();
      await interaction.reply({ embeds: [createSuccessEmbed('Count has been reset to 0.')] });

    } else if (subcommand === 'set') {
      const number = interaction.options.getInteger('number');
      if (number < 0) return interaction.reply({ embeds: [createErrorEmbed('Count cannot be negative.')], ephemeral: true });

      counting.lastNumber = number;
      counting.lastUserId = interaction.user.id; // Admin updated it
      await counting.save();
      await interaction.reply({ embeds: [createSuccessEmbed(`Count has been set to **${number}**. The next number is **${number + 1}**.`)] });
    }
  }
};
