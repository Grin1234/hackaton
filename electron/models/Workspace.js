import mongoose from 'mongoose';
import { ensureMongoConnection } from '../utils/mongodb.js';

// Disable buffering on this model's connection
mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 0);

// Workspace Schema for Phase 3
const workspaceSchema = new mongoose.Schema({
  path: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  enabled: { 
    type: Boolean, 
    default: true 
  },
  autoReview: { 
    type: Boolean, 
    default: true 
  },
  notificationEnabled: { 
    type: Boolean, 
    default: true 
  },
  customGuidelines: {
    type: [String],
    default: []
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update updatedAt on save
workspaceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Use mongoose.models to avoid overwriting existing model
const Workspace = mongoose.models.Workspace || mongoose.model('Workspace', workspaceSchema);

export default Workspace;

