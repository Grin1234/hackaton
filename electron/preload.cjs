const { contextBridge, ipcRenderer } = require('electron');

// Preload script for Phase 1-5
// This safely exposes Electron APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Test API to verify IPC is working
  test: {
    ping: () => 'pong',
    getVersion: () => process.versions.electron || 'unknown'
  },
  
  // Phase 2: File Watcher APIs
  fileWatcher: {
    watch: (workspacePath) => ipcRenderer.invoke('fileWatcher:watch', workspacePath),
    unwatch: (workspacePath) => ipcRenderer.invoke('fileWatcher:unwatch', workspacePath),
    onFileChanged: (callback) => {
      ipcRenderer.on('file:changed', (event, filePath, workspacePath) => {
        callback(filePath, workspacePath);
      });
    }
  },
  
  // Phase 3: Workspace Management APIs
  workspace: {
    add: (path) => ipcRenderer.invoke('workspace:add', path),
    remove: (path) => ipcRenderer.invoke('workspace:remove', path),
    list: () => ipcRenderer.invoke('workspace:list'),
  },
  
  // Phase 4: Review APIs (also exposed as file APIs for compatibility)
  review: {
    get: (filePath) => ipcRenderer.invoke('review:get', filePath),
    list: (workspacePath) => ipcRenderer.invoke('review:list', workspacePath),
    getQueueStatus: () => ipcRenderer.invoke('review:queueStatus'),
    triggerReview: (filePath, workspacePath, mode) => ipcRenderer.invoke('review:triggerReview', filePath, workspacePath, mode),
    applyFix: (filePath, finding) => ipcRenderer.invoke('review:applyFix', filePath, finding),
    rejectFix: (filePath, findingId) => ipcRenderer.invoke('review:rejectFix', filePath, findingId),
    onReviewReady: (callback) => {
      ipcRenderer.on('review:ready', (event, data) => callback(data));
    },
    onReviewStarted: (callback) => {
      ipcRenderer.on('review:started', (event, item) => callback(item));
    },
    onReviewFailed: (callback) => {
      ipcRenderer.on('review:failed', (event, data) => callback(data));
    },
  },
  
  // Phase 5: File APIs (for React components compatibility)
  file: {
    getReview: (filePath) => ipcRenderer.invoke('review:get', filePath),
    getAllReviews: (workspacePath) => ipcRenderer.invoke('review:list', workspacePath),
    saveFile: (filePath, content) => ipcRenderer.invoke('file:save', filePath, content),
    onChanged: (callback) => {
      ipcRenderer.on('file:changed', (event, filePath, workspacePath) => {
        callback(filePath);
      });
    },
    onReviewed: (callback) => {
      ipcRenderer.on('review:ready', (event, data) => {
        callback(data.filePath, data.review);
      });
    },
  },
  
  // Git operations
  git: {
    installHook: (repoPath) => ipcRenderer.invoke('git:installHook', repoPath),
    checkStaged: (repoPath) => ipcRenderer.invoke('git:checkStaged', repoPath),
    commit: (repoPath, message) => ipcRenderer.invoke('git:commit', repoPath, message),
  },
  
  // Chat operations (LLM conversation)
  chat: {
    sendMessage: (filePath, message) => ipcRenderer.invoke('chat:sendMessage', filePath, message),
    getHistory: (filePath) => ipcRenderer.invoke('chat:getHistory', filePath),
  },
  
  // Comment operations
  comment: {
    add: (filePath, comment) => ipcRenderer.invoke('comment:add', filePath, comment),
    reply: (filePath, commentIndex, replyContent) => ipcRenderer.invoke('comment:reply', filePath, commentIndex, replyContent),
    resolve: (filePath, commentIndex) => ipcRenderer.invoke('comment:resolve', filePath, commentIndex),
  },
  
  // Review history
  reviewHistory: {
    get: (filePath) => ipcRenderer.invoke('review:getHistory', filePath),
  },
  
  // Workspace settings
  workspaceSettings: {
    update: (workspacePath, settings) => ipcRenderer.invoke('workspace:updateSettings', workspacePath, settings),
  },
  
  // App settings
  app: {
    setAutoStart: (enabled) => ipcRenderer.invoke('app:setAutoStart', enabled),
    getAutoStart: () => ipcRenderer.invoke('app:getAutoStart'),
  },
  
  // Phase 5: Dialog APIs
  dialog: {
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options),
  },
  
  // Utility
  log: (message) => {
    console.log('[Renderer]', message);
  }
});

// Log that preload script loaded
console.log('✅ Preload script loaded (Phase 1-5)');

