import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ensureMongoConnection } from '../utils/mongodb.js';
import Workspace from '../models/Workspace.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

/**
 * Workspace Manager Service - Phase 3
 * Manages workspace directories and their settings
 */
class WorkspaceManager extends EventEmitter {
  constructor() {
    super();
    this.initialized = false;
  }

  /**
   * Initialize workspace manager (connect to MongoDB)
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await ensureMongoConnection();
      this.initialized = true;
      console.log('✅ Workspace Manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Workspace Manager:', error.message);
      console.warn('⚠️ MongoDB connection failed. Workspace persistence will not work until MongoDB is available.');
      // Don't throw - allow app to continue without MongoDB
      // The manager will attempt to reconnect on next operation
    }
  }

  /**
   * Ensure MongoDB connection is ready
   */
  async ensureConnection() {
    try {
      await ensureMongoConnection();
      if (!this.initialized) {
        this.initialized = true;
      }
    } catch (error) {
      console.error('MongoDB connection error:', error.message);
      throw new Error('MongoDB connection failed. Please ensure MongoDB is running.');
    }
  }

  /**
   * Add a new workspace
   * @param {string} workspacePath - Path to workspace directory
   * @returns {Promise<Object>} Created workspace document
   */
  async addWorkspace(workspacePath) {
    await this.ensureConnection();

    // Validate path exists
    if (!existsSync(workspacePath)) {
      throw new Error('Workspace path does not exist');
    }

    // Normalize path (remove trailing slashes)
    const normalizedPath = workspacePath.replace(/[/\\]+$/, '') || workspacePath;
    
    // Check if workspace already exists
    const existingWorkspace = await Workspace.findOne({ path: normalizedPath });
    if (existingWorkspace) {
      console.log(`ℹ️ Workspace already exists: ${normalizedPath}`);
      return existingWorkspace;
    }

    // Extract workspace name from path
    const name = normalizedPath.split(/[/\\]/).pop() || 'Workspace';
    
    try {
      const workspace = new Workspace({
        path: normalizedPath,
        name: name,
        enabled: true,
        autoReview: true,
        notificationEnabled: true
      });

      await workspace.save();
      console.log(`✅ Workspace added: ${name} (${normalizedPath})`);
      
      // Emit event
      this.emit('workspaceAdded', workspace);
      
      return workspace;
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error
        const existing = await Workspace.findOne({ path: normalizedPath });
        if (existing) {
          return existing;
        }
        throw new Error('Workspace already exists');
      }
      throw error;
    }
  }

  /**
   * Remove a workspace
   * @param {string} workspacePath - Path to workspace directory
   * @returns {Promise<boolean>} True if removed, false if not found
   */
  async removeWorkspace(workspacePath) {
    await this.ensureConnection();

    const result = await Workspace.deleteOne({ path: workspacePath });
    
    if (result.deletedCount > 0) {
      console.log(`✅ Workspace removed: ${workspacePath}`);
      this.emit('workspaceRemoved', workspacePath);
      return true;
    }
    
    return false;
  }

  /**
   * Get all enabled workspaces
   * @returns {Promise<Array>} Array of workspace documents
   */
  async getWorkspaces() {
    await this.ensureConnection();

    const workspaces = await Workspace.find({ enabled: true });
    // Convert to plain objects for IPC
    return workspaces.map(ws => ws.toObject ? ws.toObject() : ws);
  }

  /**
   * Get workspace by path
   * @param {string} workspacePath - Path to workspace directory
   * @returns {Promise<Object|null>} Workspace document or null
   */
  async getWorkspace(workspacePath) {
    await this.ensureConnection();

    const workspace = await Workspace.findOne({ path: workspacePath });
    return workspace ? workspace.toObject() : null;
  }
}

// Export singleton instance
export const workspaceManager = new WorkspaceManager();
