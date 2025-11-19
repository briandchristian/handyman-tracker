// Diagnostic script to help understand data loss
import 'dotenv/config';
import mongoose from 'mongoose';

async function diagnose() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI not found in environment variables');
    }

    console.log('=== MongoDB Data Loss Diagnostic ===\n');
    
    const uri = process.env.MONGO_URI;
    console.log('Connection String (hidden):', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
    
    // Extract database name from URI if present
    const dbMatch = uri.match(/mongodb[^/]+\/([^?]+)/);
    const dbNameInUri = dbMatch ? dbMatch[1] : 'default/test';
    console.log('Database name in URI:', dbNameInUri);
    console.log('');

    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const actualDbName = db.databaseName;
    console.log('Actually connected to database:', actualDbName);
    console.log('');

    // Check all collections
    const collections = await db.listCollections().toArray();
    console.log(`Collections in "${actualDbName}":`);
    
    let totalDocs = 0;
    for (const coll of collections) {
      const count = await db.collection(coll.name).countDocuments();
      totalDocs += count;
      console.log(`  ${coll.name}: ${count} documents`);
    }
    
    console.log(`\nTotal documents: ${totalDocs}`);
    console.log('');

    // Check if this is MongoDB Atlas (has oplog/backups)
    const admin = db.admin();
    try {
      const serverStatus = await admin.serverStatus();
      console.log('MongoDB Version:', serverStatus.version);
      console.log('Host:', mongoose.connection.host);
      
      if (mongoose.connection.host.includes('mongodb.net')) {
        console.log('\n⚠️  You are using MongoDB Atlas.');
        console.log('   Check your Atlas dashboard for:');
        console.log('   1. Automated backups (if enabled)');
        console.log('   2. Point-in-time recovery');
        console.log('   3. Database snapshots');
        console.log('   Go to: https://cloud.mongodb.com/');
      }
    } catch (e) {
      console.log('Could not get server status');
    }

    // List all databases to see if data might be elsewhere
    console.log('\n=== Checking other databases ===');
    const { databases } = await admin.listDatabases();
    
    for (const dbInfo of databases) {
      if (dbInfo.name === actualDbName || dbInfo.name === 'local' || dbInfo.name === 'admin') {
        continue; // Skip current, local, and admin
      }
      
      console.log(`\nDatabase: ${dbInfo.name}`);
      try {
        const tempConn = mongoose.createConnection(uri.replace(/\/[^/?]+(\?|$)/, `/${dbInfo.name}$1`));
        await tempConn.asPromise();
        const tempCollections = await tempConn.db.listCollections().toArray();
        let dbTotalDocs = 0;
        for (const coll of tempCollections) {
          const count = await tempConn.db.collection(coll.name).countDocuments();
          dbTotalDocs += count;
          if (count > 0) {
            console.log(`  ${coll.name}: ${count} documents`);
          }
        }
        if (dbTotalDocs > 0) {
          console.log(`  ⚠️  This database has ${dbTotalDocs} total documents!`);
        }
        await tempConn.close();
      } catch (e) {
        console.log(`  (Could not access: ${e.message})`);
      }
    }

    await mongoose.disconnect();
    
    console.log('\n=== Recommendations ===');
    console.log('1. Check MongoDB Atlas dashboard for backups');
    console.log('2. Verify your MONGO_URI environment variable');
    console.log('3. Check if you have any database backups locally');
    console.log('4. Review recent code changes that might have deleted data');
    console.log('5. Check if data might be in a different database/cluster');
    
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

diagnose();


