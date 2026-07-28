import dotenv from 'dotenv';
import path from 'path';
import { pino } from 'pino';
import { initMongoDB, closeMongoDB, initUserCollection } from './db.js';

dotenv.config();
dotenv.config({ path: path.join(process.cwd(), '..', '.env') });

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: { target: 'pino-pretty', options: { colorize: true } },
});

async function runSeed() {
  logger.info('🌱 Running MongoDB Users Collection Seed Script...');
  const client = await initMongoDB(logger);

  if (!client) {
    logger.error('❌ Could not connect to MongoDB. Check your MONGODB_URL environment variable.');
    process.exit(1);
  }

  await initUserCollection(logger, true);
  logger.info('🎉 Seed completed successfully!');
  await closeMongoDB();
  process.exit(0);
}

runSeed().catch((err) => {
  logger.error({ err }, '💥 Unhandled error in seed script');
  process.exit(1);
});
