/**
 * Copy application collections from `test` → `handyman` (insert-only).
 *
 * Safety:
 * - Never updates or deletes documents in `handyman`.
 * - Inserts a document only if no document with the same `_id` exists in `handyman`.
 * - On duplicate key (e.g. unique index other than _id), skips and logs.
 *
 * Order respects typical refs: customers & suppliers before inventory/POs/service history.
 *
 * Usage:
 *   node scripts/migrate-documents-test-to-handyman.mjs
 *   node scripts/migrate-documents-test-to-handyman.mjs --dry-run
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ override: true });

const SOURCE_DB = 'test';
const TARGET_DB = 'handyman';

/** @type {string[]} */
const COLLECTIONS = [
  'customers',
  'suppliers',
  'inventoryitems',
  'purchaseorders',
  'servicehistories',
];

const dryRun = process.argv.includes('--dry-run');

async function migrateCollection(sourceCol, targetCol, label) {
  let inserted = 0;
  let skippedId = 0;
  let skippedDup = 0;

  const cursor = sourceCol.find({});
  for await (const doc of cursor) {
    const existing = await targetCol.findOne({ _id: doc._id });
    if (existing) {
      skippedId += 1;
      continue;
    }
    if (dryRun) {
      inserted += 1;
      continue;
    }
    try {
      await targetCol.insertOne(doc);
      inserted += 1;
      console.log(`${label} inserted _id=${doc._id}`);
    } catch (err) {
      if (err?.code === 11000) {
        skippedDup += 1;
        console.warn(`${label} SKIP duplicate key _id=${doc._id}: ${err.message}`);
      } else {
        throw err;
      }
    }
  }
  return { inserted, skippedId, skippedDup };
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

  const sourceConn = mongoose.createConnection(uri, { ...connectOptions, dbName: SOURCE_DB });
  const targetConn = mongoose.createConnection(uri, { ...connectOptions, dbName: TARGET_DB });
  await sourceConn.asPromise();
  await targetConn.asPromise();

  const totals = { inserted: 0, skippedId: 0, skippedDup: 0 };

  for (const name of COLLECTIONS) {
    const sourceCol = sourceConn.db.collection(name);
    const targetCol = targetConn.db.collection(name);
    const stats = await migrateCollection(sourceCol, targetCol, `[${name}]`);
    totals.inserted += stats.inserted;
    totals.skippedId += stats.skippedId;
    totals.skippedDup += stats.skippedDup;
    console.log(
      `--- ${name}: inserted=${stats.inserted} skippedExistingId=${stats.skippedId} skippedDupKey=${stats.skippedDup}`
    );
  }

  console.log('=== TOTAL', dryRun ? '(dry-run)' : '', totals);
  await sourceConn.close();
  await targetConn.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
