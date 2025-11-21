import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const loadCommands = async (client) => {
  const foldersPath = path.join(__dirname, '../commands');
  const commandFolders = fs.readdirSync(foldersPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(foldersPath, folder);

    if (fs.statSync(folderPath).isDirectory()) {
      const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
      for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = await import(filePath);
        if ('data' in command.default && 'execute' in command.default) {
          client.commands.set(command.default.data.name, command.default);
        }
      }
    } else if (folder.endsWith('.js')) {
       const filePath = path.join(foldersPath, folder);
       const command = await import(filePath);
       if ('data' in command.default && 'execute' in command.default) {
         client.commands.set(command.default.data.name, command.default);
       }
    }
  }
};

export const loadEvents = async (client) => {
  const eventsPath = path.join(__dirname, '../events');
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = await import(filePath);
    if (event.default.once) {
      client.once(event.default.name, (...args) => event.default.execute(...args));
    } else {
      client.on(event.default.name, (...args) => event.default.execute(...args));
    }
  }
};
