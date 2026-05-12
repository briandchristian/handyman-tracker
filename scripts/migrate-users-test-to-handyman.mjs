/**
 * One-way copy of User documents from database `test` to `handyman`.
 *
 * Safety (production handyman.users):
 * - Never updates or deletes existing handyman users.
 * - Inserts only when no handyman user has the same username OR email.
 * - Skips if _id already exists in handyman (avoid overwriting / corrupting).
 *
 * Usage:
 *   node scripts/migrate-users-test-to-handyman.mjs           # apply
 *   node scripts/migrate-users-test-to-handyman.mjs --dry-run # log only
 *
 * Requires .env: MONGO_URI, MONGO_USER, MONGO_PASSWORD (same as api/index.js).
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ override: true });

const SOURCE_DB = 'test';
const TARGET_DB = 'handyman';
const COLLECTION = 'users';

const dryRun = process.argv.includes('--dry-run');

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

  // dbName overrides any database path in MONGO_URI (e.g. /handyman) so we hit test + handyman explicitly.
  const sourceConn = mongoose.createConnection(uri, { ...connectOptions, dbName: SOURCE_DB });
  const targetConn = mongoose.createConnection(uri, { ...connectOptions, dbName: TARGET_DB });

  await sourceConn.asPromise();
  await targetConn.asPromise();

  const sourceCol = sourceConn.db.collection(COLLECTION);
  const targetCol = targetConn.db.collection(COLLECTION);

  const cursor = sourceCol.find({});
  let migrated = 0;
  let skippedUsernameEmail = 0;
  let skippedIdCollision = 0;

  for await (const doc of cursor) {
    const username = doc.username;
    const email = doc.email;
    if (!username || !email) {
      console.warn('SKIP invalid doc (missing username/email):', doc._id);
      continue;
    }

    const existsByIdentity = await targetCol.findOne({
      $or: [{ username }, { email }],
    });
    if (existsByIdentity) {
      skippedUsernameEmail += 1;
      console.log(
        `SKIP identity conflict: test user "${username}" — handyman already has username="${existsByIdentity.username}" email="${existsByIdentity.email}"`
      );
      continue;
    }

    const existsById = await targetCol.findOne({ _id: doc._id });
    if (existsById) {
      skippedIdCollision += 1;
      console.log(
        `SKIP _id collision: test "${username}" _id=${doc._id} — handyman doc username="${existsById.username}"`
      );
      continue;
    }

    if (dryRun) {
      console.log(`DRY-RUN would migrate: ${username} <${email}> _id=${doc._id}`);
      migrated += 1;
      continue;
    }

    await targetCol.insertOne(doc);
    migrated += 1;
    console.log(`MIGRATED: ${username} <${email}> _id=${doc._id}`);
  }

  console.log('---');
  console.log(
    dryRun ? 'DRY-RUN summary' : 'Done',
    `{ migrated: ${migrated}, skippedIdentity: ${skippedUsernameEmail}, skippedIdCollision: ${skippedIdCollision} }`
  );

  await sourceConn.close();
  await targetConn.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
