import { app, BrowserWindow, ipcMain, dialog, Tray, Menu } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { fileWatcher } from './services/fileWatcher.js';
import { workspaceManager } from './services/workspaceManager.js';
import { reviewQueue } from './services/reviewQueue.js';
import { gitHookManager } from './services/gitHookManager.js';
import notifier from 'node-notifier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow = null;
let tray = null;

// Initialize services on app ready
async function initializeServices() {
  try {
    console.log('🚀 Initializing services...');
    console.log('📍 MongoDB URI:', process.env.MONGODB_URI || 'mongodb://localhost:27017/code-review');
    await workspaceManager.initialize();
    console.log('✅ All services initialized');
  } catch (error) {
    console.error('❌ Service initialization error:', error);
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.cjs'),
    },
  });

  // Load React app (check if built, otherwise use dev server)
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  const frontendDist = join(__dirname, '../frontend/dist/index.html');
  const frontendTest = join(__dirname, '../frontend/test.html');
  
  if (isDev) {
    // In dev mode, try to load from Vite dev server, fallback to test.html
    console.log('🔧 Development mode: Loading from Vite dev server...');
    // Wait a bit for Vite to start, then load
    setTimeout(() => {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
        console.log('⚠️  Vite dev server not available, loading test.html...');
        mainWindow.loadFile(frontendTest);
      });
    }, 1000);
  } else {
    // In production, load built React app
    const { existsSync } = await import('fs');
    if (existsSync(frontendDist)) {
      console.log('📦 Production mode: Loading built React app...');
      mainWindow.loadFile(frontendDist);
    } else {
      console.log('⚠️  Built app not found, loading test.html...');
      mainWindow.loadFile(frontendTest);
    }
  }
  
  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  
  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers for Phase 2: File Watcher
ipcMain.handle('fileWatcher:watch', async (event, workspacePath) => {
  try {
    fileWatcher.watchWorkspace(workspacePath);
    return { success: true, message: `Now watching: ${workspacePath}` };
  } catch (error) {
    console.error('Error watching workspace:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fileWatcher:unwatch', async (event, workspacePath) => {
  try {
    fileWatcher.unwatchWorkspace(workspacePath);
    return { success: true, message: `Stopped watching: ${workspacePath}` };
  } catch (error) {
    console.error('Error unwatching workspace:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handlers for Phase 3: Workspace Management
ipcMain.handle('workspace:add', async (event, workspacePath) => {
  try {
    const workspace = await workspaceManager.addWorkspace(workspacePath);
    // Auto-start watching when workspace is added
    fileWatcher.watchWorkspace(workspacePath);
    return { success: true, workspace: workspace };
  } catch (error) {
    console.error('Error adding workspace:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('workspace:remove', async (event, workspacePath) => {
  try {
    // Stop watching before removing
    fileWatcher.unwatchWorkspace(workspacePath);
    const removed = await workspaceManager.removeWorkspace(workspacePath);
    return { success: removed };
  } catch (error) {
    console.error('Error removing workspace:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('workspace:list', async () => {
  try {
    const workspaces = await workspaceManager.getWorkspaces();
    return workspaces;
  } catch (error) {
    console.error('Error listing workspaces:', error);
    return [];
  }
});

fileWatcher.on('error', (error, workspacePath) => {
  console.error(`❌ File watcher error for ${workspacePath}:`, error);
});

// IPC Handlers for Phase 4: Review Operations
ipcMain.handle('review:get', async (event, filePath) => {
  try {
    const { ensureMongoConnection } = await import('./utils/mongodb.js');
    const Review = (await import('./models/Review.js')).default;
    
    await ensureMongoConnection();
    // Get latest review for this file
    const review = await Review.findOne({ filePath }).sort({ updatedAt: -1 });
    return review ? review.toObject() : null;
  } catch (error) {
    console.error('Error getting review:', error);
    return null;
  }
});

ipcMain.handle('review:list', async (event, workspacePath) => {
  try {
    const { ensureMongoConnection } = await import('./utils/mongodb.js');
    const Review = (await import('./models/Review.js')).default;
    
    await ensureMongoConnection();
    
    // Get all reviews for files in this workspace, sorted by updatedAt desc
    const allReviews = await Review.find({
      filePath: new RegExp(`^${workspacePath.replace(/\\/g, '\\\\')}`)
    }).sort({ updatedAt: -1 });
    
    // Group by filePath and get only the latest review for each file
    const fileMap = new Map();
    for (const review of allReviews) {
      const filePath = review.filePath;
      if (!fileMap.has(filePath)) {
        fileMap.set(filePath, review.toObject());
      }
    }
    
    // Return array of unique files with their latest review
    return Array.from(fileMap.values());
  } catch (error) {
    console.error('Error listing reviews:', error);
    return [];
  }
});

ipcMain.handle('review:queueStatus', async () => {
  return reviewQueue.getStatus();
});

// Handle manual review trigger
ipcMain.handle('review:triggerReview', async (event, filePath, workspacePath, mode) => {
  try {
    console.log(`🔄 Manual review triggered for ${filePath} (mode: ${mode || 'auto'})`);
    await reviewQueue.addToQueue(filePath, workspacePath, mode);
    return { success: true };
  } catch (error) {
    console.error('Error triggering review:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler for saving files
ipcMain.handle('file:save', async (event, filePath, content) => {
  try {
    const { writeFileSync } = await import('fs');
    const { ensureMongoConnection } = await import('./utils/mongodb.js');
    const Review = (await import('./models/Review.js')).default;
    
    // Write file
    writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ File saved: ${filePath}`);
    
    // Update review code content in database
    await ensureMongoConnection();
    const review = await Review.findOne({ filePath });
    if (review) {
      review.codeContent = content;
      review.updatedAt = new Date();
      await review.save();
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error saving file:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handlers for Phase 5: Apply/Reject Fixes
ipcMain.handle('review:applyFix', async (event, filePath, finding) => {
  console.log('🔧 [IPC] applyFix called:', { filePath, finding });
  
  try {
    const { ensureMongoConnection } = await import('./utils/mongodb.js');
    const Review = (await import('./models/Review.js')).default;
    const { readFileSync, writeFileSync } = await import('fs');
    
    console.log('📝 [IPC] Connecting to MongoDB...');
    await ensureMongoConnection();
    
    // Get the review document
    console.log('📝 [IPC] Finding review for:', filePath);
    const review = await Review.findOne({ filePath });
    if (!review) {
      console.error('❌ [IPC] Review not found for:', filePath);
      throw new Error('Review not found for this file');
    }
    
    console.log('📝 [IPC] Review found, finding index for finding:', finding);
    
    // Find the finding in the review
    const findingIndex = review.findings.findIndex(
      f => f._id?.toString() === finding._id?.toString() || 
           (f.lineNumber === finding.lineNumber && f.message === finding.message)
    );
    
    if (findingIndex === -1) {
      console.error('❌ [IPC] Finding not found. Available findings:', review.findings.map(f => ({
        _id: f._id?.toString(),
        lineNumber: f.lineNumber,
        message: f.message
      })));
      throw new Error('Finding not found in review');
    }
    
    console.log('✅ [IPC] Finding found at index:', findingIndex);
    
    // Check if suggestion exists
    const findingInReview = review.findings[findingIndex];
    if (!findingInReview.suggestion) {
      console.error('❌ [IPC] No suggestion in finding:', findingInReview);
      throw new Error('No suggestion available');
    }
    
    // Apply the fix to the file
    try {
      // Read CURRENT file content (not stale review.codeContent)
      console.log('📝 [IPC] Reading file:', filePath);
      let fileContent = readFileSync(filePath, 'utf-8');
      const lines = fileContent.split('\n');
      
      // Temporarily pause file watching for this file to prevent re-review loop
      const wasWatching = fileWatcher.isWatching(filePath);
      if (wasWatching) {
        console.log('⏸️  [IPC] Pausing file watching');
        fileWatcher.pauseWatching(filePath);
      }
      
      try {
        // Use Ollama to generate the actual code fix
        const projectRoot = join(__dirname, '..');
        const ollamaServicePath = join(projectRoot, 'backend/src/services/ollamaService.js');
        const { generateCodeFix } = await import(ollamaServicePath);
        
        console.log(`🤖 [IPC] Generating code fix for line ${finding.lineNumber}...`);
        
        // Use CURRENT file content for fix generation
        const fixedCodeLines = await generateCodeFix(fileContent, review.language, findingInReview);
        console.log(`✅ [IPC] Generated fix:`, fixedCodeLines);
        
        // Check if this is a remove operation
        if (fixedCodeLines === '__REMOVE_LINE__') {
          // Remove the line
          if (finding.lineNumber && finding.lineNumber > 0 && finding.lineNumber <= lines.length) {
            const lineIndex = finding.lineNumber - 1;
            lines.splice(lineIndex, 1); // Remove the line
            fileContent = lines.join('\n');
            writeFileSync(filePath, fileContent, 'utf-8');
            console.log(`✅ [IPC] Removed line ${finding.lineNumber} from ${filePath}`);
            
            // Update review with new file content and mark finding as applied
            review.codeContent = fileContent;
            review.findings[findingIndex].applied = true;
            review.findings[findingIndex].rejected = false;
            
            // Adjust line numbers for all findings after this line (they shifted up by 1)
            review.findings.forEach((f, idx) => {
              if (idx !== findingIndex && f.lineNumber && f.lineNumber > finding.lineNumber) {
                f.lineNumber -= 1;
              }
            });
          } else {
            throw new Error('Cannot remove line: invalid line number');
          }
        } else if (finding.lineNumber && finding.lineNumber > 0 && finding.lineNumber <= lines.length) {
          // Apply fix at specific line
          const lineIndex = finding.lineNumber - 1;
          const originalLine = lines[lineIndex];
          console.log(`📝 [IPC] Original line ${finding.lineNumber}:`, originalLine);
          
          // Preserve indentation from original line
          const indentMatch = originalLine.match(/^(\s*)/);
          const indent = indentMatch ? indentMatch[1] : '';
          
          const fixedLines = fixedCodeLines.split('\n').map((line, idx) => {
            // First line uses original indentation, others use relative indentation
            if (idx === 0) {
              const lineIndentMatch = line.match(/^(\s*)/);
              const lineIndent = lineIndentMatch ? lineIndentMatch[1] : '';
              // If fix already has indentation, use it; otherwise preserve original
              return lineIndent ? line : indent + line.trim();
            }
            return line;
          });
          
          console.log(`📝 [IPC] Fixed lines:`, fixedLines);
          
          // Replace the problematic line(s) with the fixed code
          if (fixedLines.length === 1) {
            lines[lineIndex] = fixedLines[0];
          } else {
            // Multi-line fix - replace from the target line
            lines.splice(lineIndex, 1, ...fixedLines);
          }
          
          fileContent = lines.join('\n');
          writeFileSync(filePath, fileContent, 'utf-8');
          console.log(`✅ [IPC] Applied fix to ${filePath} at line ${finding.lineNumber}`);
          
          // Update review with new file content and mark finding as applied
          review.codeContent = fileContent; // Update with current content
          review.findings[findingIndex].applied = true;
          review.findings[findingIndex].rejected = false;
          
          // Adjust line numbers for other findings after this line (they may have shifted)
          if (fixedLines.length !== 1) {
            const lineShift = fixedLines.length - 1;
            review.findings.forEach((f, idx) => {
              if (idx !== findingIndex && f.lineNumber && f.lineNumber > finding.lineNumber) {
                f.lineNumber += lineShift;
              }
            });
          }
        } else {
          // General fix - append at end (for general suggestions)
          fileContent += '\n' + fixedCodeLines;
          writeFileSync(filePath, fileContent, 'utf-8');
          console.log(`✅ [IPC] Applied general fix to ${filePath}`);
          review.codeContent = fileContent;
          review.findings[findingIndex].applied = true;
          review.findings[findingIndex].rejected = false;
        }
        
        review.updatedAt = new Date();
        await review.save();
        console.log('✅ [IPC] Review saved');
        
        // Re-enable file watching after a delay to prevent immediate re-review
        if (wasWatching) {
          setTimeout(() => {
            fileWatcher.resumeWatching(filePath);
          }, 2000); // 2 second delay
        }
        
        return { success: true, message: 'Fix applied successfully' };
      } catch (fixError) {
        console.error('❌ [IPC] Fix error:', fixError);
        // Re-enable watching on error
        if (wasWatching) {
          fileWatcher.resumeWatching(filePath);
        }
        throw fixError;
      }
    } catch (fileError) {
      console.error('❌ [IPC] File error:', fileError);
      throw new Error(`Failed to apply fix to file: ${fileError.message}`);
    }
  } catch (error) {
    console.error('❌ [IPC] Error applying fix:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('review:rejectFix', async (event, filePath, findingId) => {
  try {
    const { ensureMongoConnection } = await import('./utils/mongodb.js');
    const Review = (await import('./models/Review.js')).default;
    
    await ensureMongoConnection();
    
    const review = await Review.findOne({ filePath });
    if (!review) {
      throw new Error('Review not found for this file');
    }
    
    // Find and mark the finding as rejected
    const findingIndex = review.findings.findIndex(
      f => f._id?.toString() === findingId?.toString()
    );
    
    if (findingIndex === -1) {
      throw new Error('Finding not found');
    }
    
    review.findings[findingIndex].rejected = true;
    review.findings[findingIndex].applied = false;
    review.updatedAt = new Date();
    
    await review.save();
    
    console.log(`✅ Rejected fix for finding ${findingId} in ${filePath}`);
    return { success: true, message: 'Fix rejected' };
  } catch (error) {
    console.error('Error rejecting fix:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handlers for Phase 5: Dialog
ipcMain.handle('dialog:showOpenDialog', async (event, options) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: options.properties || ['openFile'],
      ...options
    });
    return result;
  } catch (error) {
    console.error('Error showing dialog:', error);
    return { canceled: true, filePaths: [] };
  }
});

// IPC Handlers for Git Hook Management
ipcMain.handle('git:installHook', async (event, repoPath) => {
  try {
    const result = await gitHookManager.installHook(repoPath);
    return { success: true, hookPath: result.hookPath };
  } catch (error) {
    console.error('Error installing git hook:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git:checkStaged', async (event, repoPath) => {
  try {
    const reviews = await gitHookManager.checkStagedFiles(repoPath);
    return { success: true, reviews };
  } catch (error) {
    console.error('Error checking staged files:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git:commit', async (event, repoPath, message) => {
  try {
    const result = await gitHookManager.commitWithReview(repoPath, message);
    return { success: true };
  } catch (error) {
    console.error('Error committing:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler for LLM Chat
ipcMain.handle('chat:sendMessage', async (event, filePath, userMessage) => {
  try {
    const { ensureMongoConnection } = await import('./utils/mongodb.js');
    const Review = (await import('./models/Review.js')).default;
    const ollamaServicePath = join(__dirname, '../backend/src/services/ollamaService.js');
    
    await ensureMongoConnection();
    
    // Get the latest review for this file
    const review = await Review.findOne({ filePath }).sort({ updatedAt: -1 });
    if (!review) {
      throw new Error('Review not found for this file');
    }
    
    // Get chat history for this file (store in review document)
    if (!review.chatHistory) {
      review.chatHistory = [];
    }
    
    // Add user message to history
    review.chatHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });
    
    // Import Ollama service
    const ollamaService = await import(ollamaServicePath);
    
    // Generate LLM reply with context
    const replyContent = await ollamaService.generateChatReply(
      review.codeContent || '',
      review.language || 'text',
      userMessage,
      review.chatHistory.slice(-10), // Last 10 messages for context
      review.findings || []
    );
    
    // Add AI reply to history
    review.chatHistory.push({
      role: 'assistant',
      content: replyContent,
      timestamp: new Date()
    });
    
    await review.save();
    
    return { success: true, reply: replyContent };
  } catch (error) {
    console.error('Error sending chat message:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler for getting chat history
ipcMain.handle('chat:getHistory', async (event, filePath) => {
  try {
    const { ensureMongoConnection } = await import('./utils/mongodb.js');
    const Review = (await import('./models/Review.js')).default;
    
    await ensureMongoConnection();
    
    const review = await Review.findOne({ filePath }).sort({ updatedAt: -1 });
    if (!review) {
      return { success: true, history: [] };
    }
    
    return { success: true, history: review.chatHistory || [] };
  } catch (error) {
    console.error('Error getting chat history:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handlers for Comment Management
ipcMain.handle('comment:add', async (event, filePath, comment) => {
  try {
    const { ensureMongoConnection } = await import('./utils/mongodb.js');
    const Review = (await import('./models/Review.js')).default;
    
    await ensureMongoConnection();
    const review = await Review.findOne({ filePath });
    if (!review) {
      throw new Error('Review not found for this file');
    }
    
    if (!review.comments) {
      review.comments = [];
    }
    
    review.comments.push({
      lineNumber: comment.lineNumber,
      content: comment.content,
      type: comment.type || 'suggestion',
      createdAt: new Date()
    });
    
    await review.save();
    return { success: true, comment: review.comments[review.comments.length - 1] };
  } catch (error) {
    console.error('Error adding comment:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('comment:reply', async (event, filePath, commentIndex, replyContent) => {
  try {
    const { ensureMongoConnection } = await import('./utils/mongodb.js');
    const Review = (await import('./models/Review.js')).default;
    
    await ensureMongoConnection();
    const review = await Review.findOne({ filePath });
    if (!review || !review.comments || !review.comments[commentIndex]) {
      throw new Error('Comment not found');
    }
    
    if (!review.comments[commentIndex].replies) {
      review.comments[commentIndex].replies = [];
    }
    
    review.comments[commentIndex].replies.push({
      content: replyContent,
      createdAt: new Date()
    });
    
    await review.save();
    return { success: true };
  } catch (error) {
    console.error('Error replying to comment:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('comment:resolve', async (event, filePath, commentIndex) => {
  try {
    const { ensureMongoConnection } = await import('./utils/mongodb.js');
    const Review = (await import('./models/Review.js')).default;
    
    await ensureMongoConnection();
    const review = await Review.findOne({ filePath });
    if (!review || !review.comments || !review.comments[commentIndex]) {
      throw new Error('Comment not found');
    }
    
    review.comments[commentIndex].resolved = true;
    await review.save();
    return { success: true };
  } catch (error) {
    console.error('Error resolving comment:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handlers for Review History
ipcMain.handle('review:getHistory', async (event, filePath) => {
  try {
    const { ensureMongoConnection } = await import('./utils/mongodb.js');
    const Review = (await import('./models/Review.js')).default;
    
    await ensureMongoConnection();
    // Get all reviews for this file (history)
    const reviews = await Review.find({ filePath }).sort({ updatedAt: -1 });
    return reviews.map(r => r.toObject());
  } catch (error) {
    console.error('Error getting review history:', error);
    return [];
  }
});

// IPC Handlers for Workspace Settings
ipcMain.handle('workspace:updateSettings', async (event, workspacePath, settings) => {
  try {
    await workspaceManager.ensureConnection();
    const Workspace = (await import('./models/Workspace.js')).default;
    
    const workspace = await Workspace.findOne({ path: workspacePath });
    if (!workspace) {
      throw new Error('Workspace not found');
    }
    
    Object.assign(workspace, settings);
    await workspace.save();
    
    return { success: true, workspace: workspace.toObject() };
  } catch (error) {
    console.error('Error updating workspace settings:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler for Auto-start
ipcMain.handle('app:setAutoStart', async (event, enabled) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: false
    });
    return { success: true };
  } catch (error) {
    console.error('Error setting auto-start:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('app:getAutoStart', async () => {
  try {
    const settings = app.getLoginItemSettings();
    return { enabled: settings.openAtLogin };
  } catch (error) {
    console.error('Error getting auto-start:', error);
    return { enabled: false };
  }
});

// Listen for file change events - Phase 4: Auto-review on file change
fileWatcher.on('fileChanged', async (filePath, workspacePath) => {
  console.log(`📝 File changed event: ${filePath}`);
  
  // Add to review queue
  await reviewQueue.addToQueue(filePath, workspacePath);
  
  // Send event to renderer process
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('file:changed', filePath, workspacePath);
  }
});

// Listen for review events - Phase 4 & 5
reviewQueue.on('reviewReady', async (data) => {
  console.log(`✅ Review ready for: ${data.filePath}`);
  
  // Send review to renderer process
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('review:ready', data);
  }
  
  // Phase 5: Show desktop notification for critical/high findings
  if (data.review && data.review.findings) {
    const criticalFindings = data.review.findings.filter(f => f.severity === 'critical');
    const highFindings = data.review.findings.filter(f => f.severity === 'high');
    
    if (criticalFindings.length > 0 || highFindings.length > 0) {
      const fileName = data.filePath.split(/[/\\]/).pop();
      const severity = criticalFindings.length > 0 ? 'critical' : 'high';
      const count = criticalFindings.length > 0 ? criticalFindings.length : highFindings.length;
      
      const { existsSync } = await import('fs');
      const iconPath = join(__dirname, '../assets/icon.png');
      
      notifier.notify({
        title: 'Code Review: Issues Found',
        message: `${count} ${severity} issue(s) found in ${fileName}`,
        ...(existsSync(iconPath) && { icon: iconPath }),
        sound: true,
        urgency: severity === 'critical' ? 'critical' : 'normal',
        timeout: 10
      });
      
      console.log(`🔔 Notification sent: ${count} ${severity} issue(s) in ${fileName}`);
    }
  }
});

reviewQueue.on('reviewStarted', (item) => {
  console.log(`🔍 Review started: ${item.filePath}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('review:started', item);
  }
});

reviewQueue.on('reviewFailed', (item, error) => {
  console.error(`❌ Review failed: ${item.filePath}`, error.message);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('review:failed', { item, error: error.message });
  }
});

// Listen for workspace events
workspaceManager.on('workspaceAdded', (workspace) => {
  console.log(`📁 Workspace added: ${workspace.name}`);
  // Auto-start file watching
  fileWatcher.watchWorkspace(workspace.path);
});

workspaceManager.on('workspaceRemoved', (workspacePath) => {
  console.log(`📁 Workspace removed: ${workspacePath}`);
  // Stop file watching
  fileWatcher.unwatchWorkspace(workspacePath);
});

app.whenReady().then(async () => {
  console.log('🚀 Electron app ready, initializing services...');
  
  // Initialize services first
  await initializeServices();
  
  // Load existing workspaces and start watching
  try {
    const workspaces = await workspaceManager.getWorkspaces();
    console.log(`📁 Loading ${workspaces.length} existing workspace(s)...`);
    workspaces.forEach(workspace => {
      console.log(`  - Watching: ${workspace.name} (${workspace.path})`);
      fileWatcher.watchWorkspace(workspace.path);
    });
  } catch (error) {
    console.error('❌ Error loading workspaces:', error.message || error);
  }
  
  console.log('🪟 Creating window...');
  createWindow();
  console.log('✅ Window created');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Stop all file watchers before quitting
  fileWatcher.stop();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
