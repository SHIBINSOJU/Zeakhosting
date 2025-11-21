import { createTicket, claimTicket, closeTicket, generateTranscript, toggleLock } from '../services/ticketService.js';
import logger from '../utils/logger.js';

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        logger.warn(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`Error executing ${interaction.commandName}`, error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
          await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
      }
    } else if (interaction.isButton()) {
      const { customId } = interaction;

      try {
        if (customId.startsWith('ticket_create_')) {
          const type = customId.replace('ticket_create_', '');
          await createTicket(interaction, type);
        } else if (customId.startsWith('ticket_claim_')) {
          const ticketId = customId.replace('ticket_claim_', '');
          await claimTicket(interaction, ticketId);
        } else if (customId.startsWith('ticket_close_')) {
          const ticketId = customId.replace('ticket_close_', '');
          // Logic for confirmation could go here, but for now direct close
          // Or we can use a modal if we want a reason.
          // The prompt mentioned confirmation "modal or ephemeral confirmation".
          // I will use a quick confirmation logic: if it's just a button click, show a confirmation message
          // But to keep it simple and robust, let's assume we skip confirmation UI complexity for this step or
          // implement it directly.
          // Let's implement a simple confirmation using a follow-up button if needed, or just close it.
          // Given the prompt "Show a confirmation (modal or ephemeral confirmation)", let's do ephemeral confirmation.

          // Actually, to properly do confirmation we need another interaction step.
          // I'll just assume "Close" does the job for this simplified structure unless I want to nest listeners which is bad.
          // A better way is to reply ephemeral with a "Confirm Close" button.

          // Let's stick to direct close for code simplicity unless I refactor heavily,
          // OR I can assume the user clicked "Close" and we proceed.
          // Wait, I can reply ephemeral with a button "Confirm".

          // Simulating confirmation flow:
          // 1. User clicks Close.
          // 2. Bot replies ephemeral: "Are you sure?" [Yes]
          // 3. User clicks Yes -> actually close.

          // Since I need to parse `ticket_close_confirm_ID`, let's support that.

          // Check if it is the confirm button
           await interaction.reply({
             content: 'Are you sure you want to close this ticket?',
             ephemeral: true,
             components: [{
               type: 1,
               components: [
                 { type: 2, style: 4, label: 'Confirm Close', custom_id: `ticket_confirm_close_${ticketId}`, emoji: '⚠️' }
               ]
             }]
           });

        } else if (customId.startsWith('ticket_confirm_close_')) {
             const ticketId = customId.replace('ticket_confirm_close_', '');
             // We need to defer update or reply because we are handling a button inside an ephemeral message?
             // Actually, `ticket_close` was ephemeral reply. The button inside it triggers a new interaction.
             // We can update the ephemeral message or just run the logic.
             await interaction.deferUpdate(); // Acknowledge the button press
             await closeTicket(interaction, ticketId);

        } else if (customId.startsWith('ticket_transcript_')) {
          const ticketId = customId.replace('ticket_transcript_', '');
          await generateTranscript(interaction, ticketId);
        } else if (customId.startsWith('ticket_lock_')) {
          const ticketId = customId.replace('ticket_lock_', '');
          await toggleLock(interaction, ticketId);
        }
      } catch (error) {
        logger.error('Error handling button interaction', error);
        if (!interaction.replied && !interaction.deferred) {
             await interaction.reply({ content: 'Error processing request.', ephemeral: true });
        }
      }
    }
  },
};
