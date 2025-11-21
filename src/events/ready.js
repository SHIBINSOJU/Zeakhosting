import mongoose from 'mongoose';
import logger from '../utils/logger.js';

export default {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info(`Ready! Logged in as ${client.user.tag}`);

    try {
      await mongoose.connect(process.env.MONGO_URI);
      logger.info('Connected to MongoDB');
    } catch (error) {
      logger.error('Could not connect to MongoDB', error);
      process.exit(1);
    }
  },
};
