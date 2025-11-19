// Script to list all databases on the MongoDB server
import 'dotenv/config';
import mongoose from 'mongoose';

async function listDatabases() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI not found in environment variables');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected!\n');

    const admin = mongoose.connection.db.admin();
    const { databases } = await admin.listDatabases();
    
    console.log(`Found ${databases.length} database(s) on this server:\n`);
    
    for (const db of databases) {
      console.log(`  ${db.name}: ${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB`);
      
      // Connect to this database to count collections
      const tempConn = mongoose.createConnection(process.env.MONGO_URI.replace(/\/[^/?]+(\?|$)/, `/${db.name}$1`));
      try {
        await tempConn.asPromise();
        const collections = await tempConn.db.listCollections().toArray();
        let totalDocs = 0;
        for (const coll of collections) {
          const count = await tempConn.db.collection(coll.name).countDocuments();
          totalDocs += count;
        }
        console.log(`    Collections: ${collections.length}, Total documents: ${totalDocs}`);
        await tempConn.close();
      } catch (e) {
        console.log(`    (Could not access)`);
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

listDatabases();


