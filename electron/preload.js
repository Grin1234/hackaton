const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Workspace management
  workspace: {
    add: (path) => ipcRenderer.invoke('workspace:add', path),
    remove: (path) => ipcRenderer.invoke('workspace:remove', path),
    list: () => ipcRenderer.invoke('workspace:list'),
    getStatus: (path) => ipcRenderer.invoke('workspace:getStatus', path),
  },
  
  // File operations
  file: {
    getReview: (path) => ipcRenderer.invoke('file:getReview', path),
    getAllReviews: (workspacePath) => ipcRenderer.invoke('file:getAllReviews', workspacePath),
    onChanged: (callback) => ipcRenderer.on('file:changed', (event, ...args) => callback(...args)),
    onReviewed: (callback) => ipcRenderer.on('file:reviewed', (event, ...args) => callback(...args)),
  },
  
  // Review operations
  review: {
    applyFix: (filePath, fix) => ipcRenderer.invoke('review:applyFix', filePath, fix),
    rejectFix: (filePath, fixId) => ipcRenderer.invoke('review:rejectFix', filePath, fixId),
  },
  
  // Git operations
  git: {
    installHook: (repoPath) => ipcRenderer.invoke('git:installHook', repoPath),
    checkStaged: (repoPath) => ipcRenderer.invoke('git:checkStaged', repoPath),
    commit: (repoPath, message) => ipcRenderer.invoke('git:commit', repoPath, message),
  },
  
  // Dialog operations
  dialog: {
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options),
  },
});
