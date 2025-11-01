#!/usr/bin/env node

/**
 * Script to fix MongoDB unique index issue
 * Drops the old unique index on filePath and creates a compound index for review history
 */

import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/code-review';

async function fixIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const collection = mongoose.connection.db.collection('reviews');
    
    // Get all indexes
    console.log('\n📋 Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique || false})`);
    });

    // Drop any unique index on filePath
    console.log('\n🗑️  Dropping unique indexes on filePath...');
    for (const index of indexes) {
      if (index.unique && index.key && index.key.filePath === 1) {
        const indexName = index.name || 'filePath_1';
        try {
          await collection.dropIndex(indexName);
          console.log(`  ✅ Dropped: ${indexName}`);
        } catch (err) {
          console.log(`  ⚠️  Could not drop ${indexName}: ${err.message}`);
        }
      }
    }

    // Also try common index names
    const commonNames = ['filePath_1', 'filePath_1_1'];
    for (const name of commonNames) {
      try {
        await collection.dropIndex(name);
        console.log(`  ✅ Dropped: ${name}`);
      } catch (err) {
        // Index might not exist, that's okay
      }
    }

    // Create compound index for history queries
    console.log('\n📝 Creating compound index for review history...');
    try {
      await collection.createIndex({ filePath: 1, updatedAt: -1 }, { name: 'filePath_1_updatedAt_-1' });
      console.log('  ✅ Created compound index: filePath_1_updatedAt_-1');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('  ℹ️  Index already exists');
      } else {
        console.log(`  ⚠️  Could not create index: ${err.message}`);
      }
    }

    // Verify final indexes
    console.log('\n📋 Final indexes:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${idx.unique || false})`);
    });

    console.log('\n✅ Index fix complete!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixIndexes();

