/**
 * Print document counts per collection for `test` vs `handyman`.
 * Uses same env as the API: MONGO_URI, MONGO_USER, MONGO_PASSWORD.
 *
 *   node scripts/mongo-db-summary.mjs
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ override: true });

const COLLECTIONS = [
  'users',
  'customers',
  'suppliers',
  'purchaseorders',
  'inventoryitems',
  'servicehistories',
];

async function countAll(db) {
  const out = {};
  for (const name of COLLECTIONS) {
    try {
      out[name] = await db.collection(name).countDocuments();
    } catch {
      out[name] = 'err';
    }
  }
  return out;
}

async function main() {
  const mongoUri = process.env.MONGO_URI?.trim();
  const mongoUser = process.env.MONGO_USER?.trim();
  const mongoPassword = process.env.MONGO_PASSWORD?.trim();
  if (!mongoUri) {
    console.error('MONGO_URI is required.');
    process.exit(1);
  }

  const connectOptions = {
    serverSelectionTimeoutMS: 30_000,
    socketTimeoutMS: 45_000,
  };
  let uri = mongoUri;
  if (mongoUser && mongoPassword) {
    connectOptions.user = mongoUser;
    connectOptions.pass = mongoPassword;
    connectOptions.authSource = 'admin';
    uri = mongoUri.replace(/^mongodb:\/\/[^@]+@/, 'mongodb://');
  }

  const testConn = mongoose.createConnection(uri, { ...connectOptions, dbName: 'test' });
  const handymanConn = mongoose.createConnection(uri, { ...connectOptions, dbName: 'handyman' });
  await testConn.asPromise();
  await handymanConn.asPromise();

  const testCounts = await countAll(testConn.db);
  const handymanCounts = await countAll(handymanConn.db);

  console.log('Collection          test    handyman');
  console.log('-'.repeat(44));
  for (const c of COLLECTIONS) {
    const t = testCounts[c];
    const h = handymanCounts[c];
    console.log(`${c.padEnd(18)} ${String(t).padStart(6)} ${String(h).padStart(10)}`);
  }

  await testConn.close();
  await handymanConn.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
