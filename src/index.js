import { Client, Collection, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { loadCommands, loadEvents } from './utils/handlers.js';
import logger from './utils/logger.js';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

// Anti-crash
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
});

(async () => {
  await loadCommands(client);
  await loadEvents(client);

  if (!process.env.TOKEN) {
    logger.error('TOKEN is missing in .env');
    process.exit(1);
  }

  client.login(process.env.TOKEN).catch(err => {
    logger.error('Failed to login', err);
  });
})();
