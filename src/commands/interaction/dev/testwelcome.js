const { MessageFlags } = require("discord.js");

module.exports = {
    name: "testwelcome",
    description: "Simulate a welcome event for yourself to test the image",
    category: "dev",
    devOnly: true, // Only you can use this
    execute: async (client, interaction) => {
        // 1. Get your own member profile
        const member = interaction.member;

        // 2. Manually trigger the Welcome Event
        // This tells the bot: "Hey, this person just joined!"
        client.emit("guildMemberAdd", member);

        // 3. Confirm it sent
        await interaction.reply({ 
            content: "✅ Simulated a welcome event! **Check your configured welcome channel.**", 
            flags: [MessageFlags.Ephemeral] 
        });
    }
};
