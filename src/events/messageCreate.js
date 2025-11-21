import { handleCountingMessage } from '../services/countingService.js';

export default {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    await handleCountingMessage(message);
  },
};
