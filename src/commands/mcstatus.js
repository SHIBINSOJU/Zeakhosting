import { 
    EmbedBuilder, 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle, 
    ComponentType,
    AttachmentBuilder
} from 'discord.js';
import { status } from 'minecraft-server-util';

export default {
    name: 'mcstatus',
    description: 'Displays Minecraft server status and player list.',
    
    // This structure assumes you are using Slash Commands (interaction)
    // If you are using prefix commands (message), some adjustments to input parsing are needed.
    async execute(interaction, client) {
        
        // 1. Get the IP from arguments. (Change 'ip' to whatever your option name is)
        // If using prefix commands: const ip = args[0];
        const ip = interaction.options.getString('ip'); 
        if (!ip) return interaction.reply({ content: 'Please provide a server IP!', ephemeral: true });

        // Acknowledge the command immediately so the bot doesn't timeout while fetching
        await interaction.deferReply();

        try {
            // 2. Fetch Server Status (Standard Java/Geyser Query)
            // Default port is 25565. This works for Geyser if querying the Java port.
            const result = await status(ip);

            // 3. Create the Favicon (Server Icon)
            let iconAttachment = null;
            if (result.favicon) {
                const buffer = Buffer.from(result.favicon.split(',')[1], 'base64');
                iconAttachment = new AttachmentBuilder(buffer, { name: 'icon.png' });
            }

            // 4. Build the Status Embed
            const statusEmbed = new EmbedBuilder()
                .setColor('#2F3136')
                .setTitle(`${ip} Status`)
                .setDescription(result.motd.clean || 'No MOTD')
                .addFields(
                    { name: '🟢 Status', value: 'Online', inline: true },
                    { name: '📶 Ping', value: `${result.roundTripLatency}ms`, inline: true },
                    { name: '👥 Players', value: `${result.players.online} / ${result.players.max}`, inline: true },
                    { name: '🔧 Version', value: result.version.name || 'Unknown', inline: true }
                )
                .setTimestamp();

            if (iconAttachment) {
                statusEmbed.setThumbnail('attachment://icon.png');
            }

            // 5. Create the "Playerlist" Button
            const playerButton = new ButtonBuilder()
                .setCustomId('get_playerlist')
                .setLabel('Show Playerlist')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📜');

            const row = new ActionRowBuilder().addComponents(playerButton);

            // 6. Send the initial message
            const response = await interaction.editReply({
                embeds: [statusEmbed],
                components: [row],
                files: iconAttachment ? [iconAttachment] : []
            });

            // 7. Create a Collector to handle button clicks
            // This allows the button to work for 15 minutes (900000ms)
            const collector = response.createMessageComponentCollector({ 
                componentType: ComponentType.Button, 
                time: 900000 
            });

            collector.on('collect', async (i) => {
                if (i.customId === 'get_playerlist') {
                    
                    // Logic for the Ephemeral Player List
                    let playerDescription = 'No players online.';
                    
                    // Check if sample players exist
                    if (result.players.sample && result.players.sample.length > 0) {
                        // Map the names from the sample data
                        playerDescription = result.players.sample.map(p => `• **${p.name}**`).join('\n');
                        
                        // Note: Standard query only returns a "sample" (usually 12 players).
                        if (result.players.online > result.players.sample.length) {
                            playerDescription += `\n\n*...and ${result.players.online - result.players.sample.length} more.*`;
                        }
                    } else if (result.players.online > 0) {
                        playerDescription = 'Players are online, but the server is hiding their names (Query disabled).';
                    }

                    const playerEmbed = new EmbedBuilder()
                        .setColor('#00AA00')
                        .setTitle(`Online Players (${result.players.online})`)
                        .setDescription(playerDescription);

                    // Send the private (ephemeral) message
                    await i.reply({ 
                        embeds: [playerEmbed], 
                        ephemeral: true 
                    });
                }
            });

            collector.on('end', () => {
                // Optional: Disable the button after time runs out
                const disabledRow = new ActionRowBuilder().addComponents(
                    playerButton.setDisabled(true).setLabel('Expired')
                );
                interaction.editReply({ components: [disabledRow] }).catch(() => {});
            });

        } catch (error) {
            console.error(error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🔴 Server Offline')
                .setDescription(`Could not connect to **${ip}**.\nThe server might be offline or the IP is incorrect.`);
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
                      
