import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

dotenv.config({ path: join(projectRoot, 'backend/.env') });

// Shared MongoDB connection utility for Phase 3
// This ensures we only connect once and all services use the same connection
let connectionPromise = null;

export function resetConnection() {
  connectionPromise = null;
  if (mongoose.connection.readyState !== 0) {
    mongoose.connection.close().catch(() => {});
  }
}

export async function ensureMongoConnection() {
  // If already connected, verify it's truly ready
  if (mongoose.connection.readyState === 1) {
    // Verify connection is actually working by checking if we can ping
    try {
      await mongoose.connection.db.admin().ping();
      return mongoose.connection;
    } catch (error) {
      // Connection state says connected but ping failed - reset and reconnect
      console.warn('Connection state says connected but ping failed, reconnecting...');
      connectionPromise = null;
      mongoose.connection.close().catch(() => {});
    }
  }
  
  // If already connecting, wait for that connection
  if (connectionPromise) {
    return await connectionPromise;
  }
  
  // Disable buffering BEFORE connecting
  mongoose.set('bufferCommands', false);
  mongoose.set('bufferTimeoutMS', 0);
  
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/code-review';
  
  console.log('🔌 Attempting MongoDB connection to:', mongoUri);
  
  // Create connection promise that waits for 'connected' event
  connectionPromise = new Promise((resolve, reject) => {
    // Set up event listeners BEFORE connecting
    const connectedHandler = async () => {
      cleanup();
      console.log('✅ MongoDB connected event fired, readyState:', mongoose.connection.readyState);
      // Wait a bit and verify connection is fully ready with a ping
      try {
        await mongoose.connection.db.admin().ping();
        console.log('✅ MongoDB connection verified with ping');
        resolve(mongoose.connection);
      } catch (pingError) {
        console.error('❌ MongoDB ping failed after connection:', pingError);
        connectionPromise = null;
        reject(new Error('MongoDB connection established but ping failed: ' + pingError.message));
      }
    };
    
    const errorHandler = (err) => {
      cleanup();
      connectionPromise = null; // Reset on error
      console.error('❌ MongoDB connection error:', err.message || err);
      reject(err);
    };
    
    // Set timeout for connection
    const timeout = setTimeout(() => {
      cleanup();
      connectionPromise = null;
      reject(new Error('MongoDB connection timeout - connection not established within 10 seconds'));
    }, 10000);
    
    const cleanup = () => {
      clearTimeout(timeout);
      mongoose.connection.removeListener('connected', connectedHandler);
      mongoose.connection.removeListener('error', errorHandler);
    };
    
    // Listen for connection events FIRST
    mongoose.connection.once('connected', connectedHandler);
    mongoose.connection.once('error', errorHandler);
    
    // Start connection
    mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferTimeoutMS: 0,
    }).then(async () => {
      // If connection completes synchronously, verify it's ready
      if (mongoose.connection.readyState === 1) {
        try {
          await mongoose.connection.db.admin().ping();
          cleanup();
          console.log('✅ MongoDB connected synchronously and verified');
          resolve(mongoose.connection);
        } catch (pingError) {
          // Connection state says connected but ping failed - wait for 'connected' event
          console.log('Connection state is 1 but ping failed, waiting for connected event...');
          // Event handler will handle it
        }
      }
      // Otherwise, wait for 'connected' event (handled above)
    }).catch((error) => {
      cleanup();
      connectionPromise = null; // Reset on error
      console.error('❌ MongoDB connect() failed:', error.message || error);
      reject(error);
    });
  });
  
  return await connectionPromise;
}

export default mongoose;
