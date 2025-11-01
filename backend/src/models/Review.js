import mongoose from 'mongoose';

// Disable buffering on this model's connection
// This ensures queries fail immediately if not connected
if (mongoose.connection.readyState === 0) {
  mongoose.set('bufferCommands', false);
  mongoose.set('bufferTimeoutMS', 0);
}

const commentSchema = new mongoose.Schema({
  lineNumber: { type: Number, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['suggestion', 'warning', 'error', 'info'], default: 'suggestion' },
  replies: [{
    content: String,
    createdAt: { type: Date, default: Date.now }
  }],
  resolved: { type: Boolean, default: false },
  rejected: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const reviewSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  filePath: { type: String, required: true }, // Removed unique: true to allow history
  language: { type: String, required: true },
  codeContent: { type: String, required: true },
  review: { type: String, required: true },
  reviewVersion: { type: Number, default: 1 }, // Track review versions
  findings: [{
    lineNumber: Number,
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    category: { type: String, enum: ['security', 'performance', 'style', 'bug', 'documentation', 'architecture', 'linting', 'testing'] },
    message: String,
    suggestion: String,
    effortEstimation: { 
      type: String, 
      enum: ['trivial', 'low', 'medium', 'high'],
      default: 'medium'
    },
    applied: { type: Boolean, default: false },
    rejected: { type: Boolean, default: false },
    guidelines: [String], // Array of guideline names (e.g., 'PEP8', 'Google Style')
    createdAt: { type: Date, default: Date.now }
  }],
  comments: [commentSchema],
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'], 
    default: 'pending' 
  },
  incremental: { type: Boolean, default: false },
  tokenUsage: {
    promptTokens: Number,
    completionTokens: Number,
    totalTokens: Number
  },
  error: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

reviewSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Drop old unique index if it exists and create new compound index for history
async function ensureIndexes() {
  try {
    if (mongoose.connection.readyState === 1) {
      const collection = mongoose.connection.db.collection('reviews');
      
      // Get all indexes and drop any unique index on filePath
      try {
        const indexes = await collection.indexes();
        for (const index of indexes) {
          // Check if this is a unique index on filePath
          if (index.unique && index.key && index.key.filePath === 1) {
            const indexName = index.name || 'filePath_1';
            await collection.dropIndex(indexName);
            console.log(`✅ Dropped old unique index: ${indexName}`);
          }
        }
      } catch (err) {
        // Try dropping common index names
        const commonNames = ['filePath_1', 'filePath_1_1'];
        for (const name of commonNames) {
          try {
            await collection.dropIndex(name);
            console.log(`✅ Dropped old unique index: ${name}`);
          } catch (dropErr) {
            // Index might not exist, continue
          }
        }
        if (!err.message.includes('index not found')) {
          console.warn('Warning dropping old index:', err.message);
        }
      }
      
      // Create compound index for history queries (only if it doesn't exist)
      try {
        await collection.createIndex({ filePath: 1, updatedAt: -1 }, { name: 'filePath_1_updatedAt_-1' });
        console.log('✅ Created compound index for review history');
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.warn('Warning creating index:', err.message);
        }
      }
    }
  } catch (err) {
    console.error('Error ensuring indexes:', err);
  }
}

// Create index for faster queries (filePath + updatedAt for history)
reviewSchema.index({ filePath: 1, updatedAt: -1 });

// Use mongoose.models to avoid overwriting existing model
const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

// Ensure indexes when model is loaded (only if connected)
if (mongoose.connection.readyState === 1) {
  ensureIndexes().catch(err => console.error('Failed to ensure indexes:', err));
} else {
  mongoose.connection.once('connected', () => {
    ensureIndexes().catch(err => console.error('Failed to ensure indexes:', err));
  });
}

export default Review;

