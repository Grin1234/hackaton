import chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { join } from 'path';

/**
 * File Watcher Service - Phase 2
 * Monitors file changes in workspace directories
 */
class FileWatcher extends EventEmitter {
  constructor() {
    super();
    this.watchers = new Map(); // workspacePath -> watcher instance
    this.debounceTimers = new Map(); // filePath -> timer
    this.debounceDelay = 1000; // 1 second delay after file save
    this.pausedFiles = new Set(); // Set of file paths that are temporarily paused
  }

  /**
   * Start watching a workspace directory
   * @param {string} workspacePath - Path to workspace directory
   */
  watchWorkspace(workspacePath) {
    // Don't watch if already watching
    if (this.watchers.has(workspacePath)) {
      console.log(`⚠️ Already watching workspace: ${workspacePath}`);
      return;
    }

    console.log(`👀 Starting to watch workspace: ${workspacePath}`);

    // Watch for code files only
    const codeExtensions = [
      '*.js', '*.jsx', '*.ts', '*.tsx',
      '*.py', '*.java', '*.cpp', '*.c', '*.h',
      '*.go', '*.rs', '*.rb', '*.php',
      '*.md', '*.json', '*.yaml', '*.yml'
    ];

    const watcher = chokidar.watch(codeExtensions, {
      cwd: workspacePath,
      ignored: [
        /(^|[\/\\])\../, // Ignore dotfiles
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/__pycache__/**',
        '**/*.pyc'
      ],
      persistent: true,
      ignoreInitial: true, // Don't trigger on initial scan
      awaitWriteFinish: {
        stabilityThreshold: 500, // Wait 500ms after last change
        pollInterval: 100
      }
    });

    // Handle file changes
    watcher.on('change', (filePath) => {
      this.handleFileChange(filePath, workspacePath);
    });

    // Handle new files
    watcher.on('add', (filePath) => {
      this.handleFileChange(filePath, workspacePath);
    });

    // Handle errors
    watcher.on('error', (error) => {
      console.error(`❌ File watcher error for ${workspacePath}:`, error);
      this.emit('error', error, workspacePath);
    });

    // Store watcher
    this.watchers.set(workspacePath, watcher);
    console.log(`✅ Now watching workspace: ${workspacePath}`);
  }

  /**
   * Stop watching a workspace directory
   * @param {string} workspacePath - Path to workspace directory
   */
  unwatchWorkspace(workspacePath) {
    const watcher = this.watchers.get(workspacePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(workspacePath);
      console.log(`❌ Stopped watching workspace: ${workspacePath}`);
    }
  }

  /**
   * Handle file change with debouncing
   * @param {string} filePath - Relative file path
   * @param {string} workspacePath - Workspace root path
   */
  handleFileChange(filePath, workspacePath) {
    const fullPath = join(workspacePath, filePath);

    // Skip if file is paused (e.g., during fix application)
    if (this.pausedFiles.has(fullPath)) {
      console.log(`⏸️  Skipping paused file: ${filePath}`);
      return;
    }

    // Clear existing timer for this file
    const existingTimer = this.debounceTimers.get(fullPath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(fullPath);
      console.log(`📝 File changed: ${filePath} (workspace: ${workspacePath})`);
      this.emit('fileChanged', fullPath, workspacePath);
    }, this.debounceDelay);

    this.debounceTimers.set(fullPath, timer);
  }

  /**
   * Pause watching for a specific file (prevents re-review loop)
   * @param {string} filePath - Full path to the file
   */
  pauseWatching(filePath) {
    this.pausedFiles.add(filePath);
    console.log(`⏸️  Paused watching: ${filePath}`);
  }

  /**
   * Resume watching for a specific file
   * @param {string} filePath - Full path to the file
   */
  resumeWatching(filePath) {
    this.pausedFiles.delete(filePath);
    console.log(`▶️  Resumed watching: ${filePath}`);
  }

  /**
   * Check if a file is being watched
   * @param {string} filePath - Full path to the file
   * @returns {boolean}
   */
  isWatching(filePath) {
    // Check if file path belongs to any watched workspace
    for (const [workspacePath, watcher] of this.watchers) {
      if (filePath.startsWith(workspacePath)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Stop all watchers
   */
  stop() {
    console.log('🛑 Stopping all file watchers...');
    this.watchers.forEach((watcher, workspacePath) => {
      watcher.close();
    });
    this.watchers.clear();
    
    // Clear all timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
  }
}

// Export singleton instance
export const fileWatcher = new FileWatcher();
