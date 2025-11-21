import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = [];
// Grab all the command folders from the commands directory
const foldersPath = path.join(__dirname, '../commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  // Check if it's a directory
  const folderPath = path.join(foldersPath, folder);
  if (fs.statSync(folderPath).isDirectory()) {
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      const command = await import(filePath);
      if ('data' in command.default && 'execute' in command.default) {
        commands.push(command.default.data.toJSON());
      } else {
        logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    }
  } else if (folder.endsWith('.js')) {
      // Handle root command files if any
      const filePath = path.join(foldersPath, folder);
      const command = await import(filePath);
      if ('data' in command.default && 'execute' in command.default) {
        commands.push(command.default.data.toJSON());
      }
  }
}

const rest = new REST().setToken(process.env.TOKEN);

(async () => {
  try {
    logger.info(`Started refreshing ${commands.length} application (/) commands.`);

    // The put method is used to fully refresh all commands in the guild with the current set
    // If GUILD_ID is not set, it deploys globally (might take up to 1 hour)
    if (process.env.GUILD_ID) {
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );
        logger.info('Successfully reloaded application (/) commands for guild.');
    } else {
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        logger.info('Successfully reloaded application (/) commands globally.');
    }

  } catch (error) {
    logger.error('Error deploying commands:', error);
  }
})();
