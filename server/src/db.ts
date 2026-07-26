import { MongoClient, MongoClientOptions } from 'mongodb';
import type { Logger } from 'pino';
import { DbUser, DailyLog } from './types.js';

let client: MongoClient | null = null;

export async function initMongoDB(logger: Logger): Promise<MongoClient | null> {
  const mongoUrl = process.env.MONGODB_URL;
  const mongoUser = process.env.MONGODB_USER;
  const mongoPassword = process.env.MONGODB_PASSWORD;

  if (!mongoUrl) {
    logger.info('ℹ️ MONGODB_URL not set. Skipping MongoDB initialization.');
    return null;
  }

  try {
    let connectionString = mongoUrl;

    // Build auth URL if credentials provided and URI does not already contain credentials
    if (mongoUser && mongoPassword && !connectionString.includes('@')) {
      const urlParts = connectionString.split('://');
      if (urlParts.length === 2) {
        const encodedUser = encodeURIComponent(mongoUser);
        const encodedPassword = encodeURIComponent(mongoPassword);
        connectionString = `${urlParts[0]}://${encodedUser}:${encodedPassword}@${urlParts[1]}`;
      }
    }

    const options: MongoClientOptions = {};
    if (mongoUser && mongoPassword && !connectionString.includes('@')) {
      options.auth = {
        username: mongoUser,
        password: mongoPassword,
      };
    }

    logger.info('🔄 Connecting to MongoDB cluster...');
    client = new MongoClient(connectionString, options);
    await client.connect();
    logger.info('🟢 Connected successfully to MongoDB cluster');
    await initUserCollection(logger);
    await initDailyLogCollection(logger);
    return client;
  } catch (error) {
    logger.error({ error }, '🔥 Failed to connect to MongoDB');
    return null;
  }
}

export async function initUserCollection(logger?: Logger, forceSeed: boolean = false): Promise<void> {
  if (!client) return;

  try {
    const db = client.db();
    const usersCollection = db.collection('users');

    // Create unique index on email
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    logger?.info('✅ Created unique index on email for "users" collection');

    const isSeedEnabled = process.env.SEED_USER_ENABLE === 'true' || forceSeed;
    if (!isSeedEnabled) {
      logger?.info('ℹ️ SEED_USER_ENABLE is false or not set. Skipping user document seeding.');
      return;
    }

    const seedEmail = process.env.SEED_USER_EMAIL || 'owenrb@gmail.com';
    const seedNickname = process.env.SEED_USER_NICKNAME || 'Owen';
    const seedGender = (process.env.SEED_USER_GENDER as any) || 'Male';
    const seedBirthdayStr = process.env.SEED_USER_BIRTHDAY || '1976-10-30T00:00:00Z';
    const seedHeight = process.env.SEED_USER_HEIGHT || '165 cm';

    const initialUser = {
      email: seedEmail,
      nickname: seedNickname,
      gender: seedGender,
      birthday: new Date(seedBirthdayStr),
      height: seedHeight,
      createdAt: new Date('2026-07-26T10:00:00Z'),
      updatedAt: new Date(),
    };

    await usersCollection.updateOne(
      { email: initialUser.email },
      { $set: { nickname: initialUser.nickname, gender: initialUser.gender, birthday: initialUser.birthday, height: initialUser.height, updatedAt: initialUser.updatedAt }, $setOnInsert: { createdAt: initialUser.createdAt } },
      { upsert: true }
    );
    logger?.info({ email: initialUser.email }, '✅ Seeded/Updated initial user document in "users" collection');
  } catch (error) {
    logger?.error({ error }, '🔥 Failed to initialize/seed "users" collection');
  }
}

export async function initDailyLogCollection(logger?: Logger): Promise<void> {
  if (!client) return;

  try {
    const db = client.db();
    const dailyLogCollection = db.collection('daily_log');

    // Create unique compound index on { userId: 1, date: 1 }
    await dailyLogCollection.createIndex({ userId: 1, date: 1 }, { unique: true });
    logger?.info('✅ Created unique compound index on { userId, date } for "daily_log" collection');
  } catch (error) {
    logger?.error({ error }, '🔥 Failed to initialize "daily_log" collection');
  }
}

export function getMongoClient(): MongoClient | null {
  return client;
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  if (!client) return null;

  try {
    const db = client.db();
    const user = await db.collection<DbUser>('users').findOne({ email: email.toLowerCase() });
    return user;
  } catch (error) {
    return null;
  }
}

export async function getDailyLogForUser(userId: any, date?: Date): Promise<DailyLog | null> {
  if (!client) return null;

  try {
    const db = client.db();
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);

    const log = await db.collection<DailyLog>('daily_log').findOne({
      userId,
      date: targetDate,
    });
    return log;
  } catch (error) {
    return null;
  }
}

export async function closeMongoDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}
