// Script to check database contents and connection info
import 'dotenv/config';
import mongoose from 'mongoose';

async function checkDatabase() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI not found in environment variables');
    }

    console.log('Connecting to MongoDB...');
    console.log('Connection string:', process.env.MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected!\n');

    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    console.log(`Database name: ${dbName}\n`);

    // List all collections
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collection(s):\n`);

    for (const collection of collections) {
      const collectionName = collection.name;
      const count = await db.collection(collectionName).countDocuments();
      console.log(`  ${collectionName}: ${count} document(s)`);
      
      // Show sample documents for main collections
      if (count > 0 && count <= 10) {
        const sample = await db.collection(collectionName).find({}).limit(3).toArray();
        console.log(`    Sample documents:`);
        sample.forEach((doc, idx) => {
          const preview = JSON.stringify(doc).substring(0, 100);
          console.log(`      ${idx + 1}. ${preview}...`);
        });
      } else if (count > 10) {
        const sample = await db.collection(collectionName).find({}).limit(1).toArray();
        if (sample.length > 0) {
          const preview = JSON.stringify(sample[0]).substring(0, 100);
          console.log(`    Sample: ${preview}...`);
        }
      }
      console.log('');
    }

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkDatabase();


