import { MongoClient, MongoClientOptions } from 'mongodb';
import type { Logger } from 'pino';
import { DbUser } from './types.js';

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
    return client;
  } catch (error) {
    logger.error({ error }, '🔥 Failed to connect to MongoDB');
    return null;
  }
}

export async function initUserCollection(logger?: Logger): Promise<void> {
  if (!client) return;

  try {
    const db = client.db();
    const usersCollection = db.collection('users');

    // Create unique index on email
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    logger?.info('✅ Created unique index on email for "users" collection');

    const initialUser = {
      email: 'owenrb@gmail.com',
      nickname: 'Owen',
      gender: 'Male',
      birthday: new Date('1976-10-30T00:00:00Z'),
      height: '165 cm',
      createdAt: new Date('2026-07-26T10:00:00Z'),
      updatedAt: new Date('2026-07-26T10:00:00Z'),
    };

    await usersCollection.updateOne(
      { email: initialUser.email },
      { $set: { height: initialUser.height }, $setOnInsert: initialUser },
      { upsert: true }
    );
    logger?.info({ email: initialUser.email }, '✅ Seeded/Updated initial user document in "users" collection');
  } catch (error) {
    logger?.error({ error }, '🔥 Failed to initialize/seed "users" collection');
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

export async function closeMongoDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}
