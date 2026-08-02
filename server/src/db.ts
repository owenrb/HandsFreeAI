import { MongoClient, MongoClientOptions } from 'mongodb';
import type { Logger } from 'pino';
import { DbUser, DailyLog, BloodPressureReading, FoodItem, Meals } from './types.js';

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
    const targetDate = date ? normalizeDate(date.toISOString()) : normalizeDate();

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

export function getLocalDateString(date?: Date | string, timeZone: string = process.env.TZ || 'Asia/Manila'): string {
  const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(validDate);
}

export function normalizeDate(dateStr?: string, timeZone: string = process.env.TZ || 'Asia/Manila'): Date {
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const yyyymmdd = dateStr.match(/^\d{4}-\d{2}-\d{2}/)
        ? dateStr.substring(0, 10)
        : getLocalDateString(d, timeZone);
      return new Date(`${yyyymmdd}T00:00:00.000Z`);
    }
  }
  const todayStr = getLocalDateString(new Date(), timeZone);
  return new Date(`${todayStr}T00:00:00.000Z`);
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}


export async function getWeight(userId: any, params: { date?: string; startDate?: string; endDate?: string }) {
  if (!client) return { error: 'Database not connected' };
  try {
    const db = client.db();
    const collection = db.collection<DailyLog>('daily_log');

    if (params.startDate || params.endDate) {
      const start = normalizeDate(params.startDate);
      const end = params.endDate ? normalizeDate(params.endDate) : normalizeDate();
      end.setUTCHours(23, 59, 59, 999);

      const logs = await collection.find({ userId, date: { $gte: start, $lte: end } }).sort({ date: 1 }).toArray();
      const records = logs.map(doc => ({
        date: formatDateISO(doc.date),
        weight: doc.metrics?.weight ?? null,
      }));
      return { records };
    } else {
      const targetDate = normalizeDate(params.date);
      const log = await collection.findOne({ userId, date: targetDate });
      return { date: formatDateISO(targetDate), weight: log?.metrics?.weight ?? null };
    }
  } catch (error) {
    return { error: 'Failed to retrieve weight log' };
  }
}

export async function setWeight(userId: any, params: { weight: number; unit?: string; date?: string }) {
  if (!client) return { error: 'Database not connected' };
  try {
    const db = client.db();
    const collection = db.collection<DailyLog>('daily_log');
    const targetDate = normalizeDate(params.date);

    await collection.updateOne(
      { userId, date: targetDate },
      {
        $set: { 'metrics.weight': params.weight, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
    return { success: true, date: formatDateISO(targetDate), weight: params.weight, unit: params.unit || 'kg' };
  } catch (error) {
    return { error: 'Failed to log weight' };
  }
}

export async function getBloodPressure(userId: any, params: { date?: string; startDate?: string; endDate?: string }) {
  if (!client) return { error: 'Database not connected' };
  try {
    const db = client.db();
    const collection = db.collection<DailyLog>('daily_log');

    if (params.startDate || params.endDate) {
      const start = normalizeDate(params.startDate);
      const end = params.endDate ? normalizeDate(params.endDate) : normalizeDate();
      end.setUTCHours(23, 59, 59, 999);

      const logs = await collection.find({ userId, date: { $gte: start, $lte: end } }).sort({ date: 1 }).toArray();
      const records = logs.map(doc => ({
        date: formatDateISO(doc.date),
        bloodPressure: doc.metrics?.bloodPressure ?? [],
      }));
      return { records };
    } else {
      const targetDate = normalizeDate(params.date);
      const log = await collection.findOne({ userId, date: targetDate });
      return { date: formatDateISO(targetDate), bloodPressure: log?.metrics?.bloodPressure ?? [] };
    }
  } catch (error) {
    return { error: 'Failed to retrieve blood pressure log' };
  }
}

export async function setBloodPressure(userId: any, params: { systolic: number; diastolic: number; date?: string }) {
  if (!client) return { error: 'Database not connected' };
  try {
    const db = client.db();
    const collection = db.collection<DailyLog>('daily_log');
    const targetDate = normalizeDate(params.date);

    const newReading: BloodPressureReading = {
      systolic: params.systolic,
      diastolic: params.diastolic,
      timestamp: new Date(),
    };

    await collection.updateOne(
      { userId, date: targetDate },
      {
        $push: { 'metrics.bloodPressure': newReading },
        $set: { updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
    return { success: true, date: formatDateISO(targetDate), reading: newReading };
  } catch (error) {
    return { error: 'Failed to log blood pressure' };
  }
}

export async function getMeals(userId: any, params: { date?: string; startDate?: string; endDate?: string }) {
  if (!client) return { error: 'Database not connected' };
  try {
    const db = client.db();
    const collection = db.collection<DailyLog>('daily_log');

    if (params.startDate || params.endDate) {
      const start = normalizeDate(params.startDate);
      const end = params.endDate ? normalizeDate(params.endDate) : normalizeDate();
      end.setUTCHours(23, 59, 59, 999);

      const logs = await collection.find({ userId, date: { $gte: start, $lte: end } }).sort({ date: 1 }).toArray();
      const records = logs.map(doc => ({
        date: formatDateISO(doc.date),
        meals: doc.meals ?? {},
        summary: doc.summary ?? {},
      }));
      return { records };
    } else {
      const targetDate = normalizeDate(params.date);
      const log = await collection.findOne({ userId, date: targetDate });
      return { date: formatDateISO(targetDate), meals: log?.meals ?? {}, summary: log?.summary ?? {} };
    }
  } catch (error) {
    return { error: 'Failed to retrieve meals log' };
  }
}

export async function setMeal(userId: any, params: { mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner'; foodItem: string; calories: number; unit?: string; date?: string }) {
  if (!client) return { error: 'Database not connected' };
  try {
    const db = client.db();
    const collection = db.collection<DailyLog>('daily_log');
    const targetDate = normalizeDate(params.date);

    const newFoodItem: FoodItem = {
      foodItem: params.foodItem,
      calories: params.calories,
      unit: params.unit || '1 serving',
    };

    const existingLog = await collection.findOne({ userId, date: targetDate });
    const currentMeals: Meals = existingLog?.meals || {};
    const categoryItems = currentMeals[params.mealType] || [];
    const updatedCategoryItems = [...categoryItems, newFoodItem];

    const updatedMeals: Meals = {
      ...currentMeals,
      [params.mealType]: updatedCategoryItems,
    };

    let totalCalories = 0;
    const mealCategories: (keyof Meals)[] = ['breakfast', 'lunch', 'snack', 'dinner'];
    for (const cat of mealCategories) {
      const items = updatedMeals[cat] || [];
      for (const item of items) {
        totalCalories += item.calories || 0;
      }
    }

    await collection.updateOne(
      { userId, date: targetDate },
      {
        $set: {
          meals: updatedMeals,
          'summary.totalCalories': totalCalories,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

    return {
      success: true,
      date: formatDateISO(targetDate),
      mealType: params.mealType,
      foodItem: newFoodItem,
      summary: { totalCalories },
    };
  } catch (error) {
    return { error: 'Failed to log meal' };
  }
}

export async function getStepCount(userId: any, params: { date?: string; startDate?: string; endDate?: string }) {
  if (!client) return { error: 'Database not connected' };
  try {
    const db = client.db();
    const collection = db.collection<DailyLog>('daily_log');

    if (params.startDate || params.endDate) {
      const start = normalizeDate(params.startDate);
      const end = params.endDate ? normalizeDate(params.endDate) : normalizeDate();
      end.setUTCHours(23, 59, 59, 999);

      const logs = await collection.find({ userId, date: { $gte: start, $lte: end } }).sort({ date: 1 }).toArray();
      const records = logs.map(doc => ({
        date: formatDateISO(doc.date),
        steps: doc.metrics?.steps ?? 0,
      }));
      return { records };
    } else {
      const targetDate = normalizeDate(params.date);
      const log = await collection.findOne({ userId, date: targetDate });
      return { date: formatDateISO(targetDate), steps: log?.metrics?.steps ?? 0 };
    }
  } catch (error) {
    return { error: 'Failed to retrieve step count log' };
  }
}

export async function setStepCount(userId: any, params: { steps: number; date?: string }) {
  if (!client) return { error: 'Database not connected' };
  try {
    const db = client.db();
    const collection = db.collection<DailyLog>('daily_log');
    const targetDate = normalizeDate(params.date);

    await collection.updateOne(
      { userId, date: targetDate },
      {
        $set: { 'metrics.steps': params.steps, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
    return { success: true, date: formatDateISO(targetDate), steps: params.steps };
  } catch (error) {
    return { error: 'Failed to log step count' };
  }
}

