// Check the admin database for data
import 'dotenv/config';
import mongoose from 'mongoose';

async function checkAdminDb() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI not found in environment variables');
    }

    // Try connecting to 'admin' database
    const uri = process.env.MONGO_URI;
    // Extract base URI without database name
    const baseUri = uri.replace(/\/[^/?]+(\?|$)/, '/admin$1');
    
    console.log('Connecting to admin database...');
    await mongoose.connect(baseUri);
    console.log('✅ Connected to admin database!\n');

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
      
      if (count > 0 && count <= 5) {
        const sample = await db.collection(collectionName).find({}).toArray();
        console.log(`    Documents:`);
        sample.forEach((doc, idx) => {
          // Show relevant fields
          if (doc.username) console.log(`      ${idx + 1}. Username: ${doc.username}, Email: ${doc.email || 'N/A'}`);
          else if (doc.name) console.log(`      ${idx + 1}. Name: ${doc.name}`);
          else console.log(`      ${idx + 1}. ${JSON.stringify(doc).substring(0, 80)}...`);
        });
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

checkAdminDb();


