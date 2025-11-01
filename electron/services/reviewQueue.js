import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ensureMongoConnection } from '../utils/mongodb.js';
import Review from '../models/Review.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

const execAsync = promisify(exec);

// Import paths for backend services
const ollamaServicePath = join(projectRoot, 'backend/src/services/ollamaService.js');
const codeParserPath = join(projectRoot, 'backend/src/services/codeParser.js');

// Cache for imported modules
let ollamaService = null;
let codeParser = null;

async function loadServices() {
  if (!ollamaService) {
    ollamaService = await import(ollamaServicePath);
  }
  if (!codeParser) {
    codeParser = await import(codeParserPath);
  }
  return { 
    generateCodeReview: ollamaService.generateCodeReview, 
    parseGitDiff: codeParser.parseGitDiff,
    extractChangedCodeSnippet: codeParser.extractChangedCodeSnippet
  };
}

/**
 * Get git diff for a file (incremental review)
 */
async function getGitDiff(filePath, repoPath) {
  try {
    // Try to get diff from git
    const relativePath = filePath.replace(repoPath + '/', '').replace(repoPath + '\\', '');
    const { stdout } = await execAsync(`cd "${repoPath}" && git diff HEAD -- "${relativePath}"`, { encoding: 'utf-8' });
    return stdout || null;
  } catch (error) {
    // File might not be tracked or no git repo
    return null;
  }
}

/**
 * Review Queue Manager - Phase 4
 * Processes code reviews in the background
 */
class ReviewQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.processing = false;
    this.maxConcurrentReviews = 1; // Process one review at a time
    this.currentReview = null;
  }

  /**
   * Add a file to the review queue
   * @param {string} filePath - Full path to the file
   * @param {string} workspacePath - Workspace root path
   * @param {string|null} mode - Review mode: 'incremental', 'full', or null (auto)
   */
  async addToQueue(filePath, workspacePath, mode = null) {
    // Check if file is already in queue
    const existing = this.queue.find(item => item.filePath === filePath);
    if (existing) {
      console.log(`⏭️ File already in queue: ${filePath}`);
      return;
    }

    // Check if file is currently being reviewed
    if (this.currentReview && this.currentReview.filePath === filePath) {
      console.log(`⏳ File currently being reviewed: ${filePath}`);
      return;
    }

    // Check if file is a code file
    const ext = extname(filePath).toLowerCase();
    const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.rb', '.php'];
    
    if (!codeExtensions.includes(ext)) {
      console.log(`⏭️ Skipping non-code file: ${filePath}`);
      return;
    }

    const queueItem = {
      filePath,
      workspacePath,
      mode, // Store review mode
      addedAt: new Date(),
      status: 'pending'
    };

    this.queue.push(queueItem);
    console.log(`📝 Added to review queue: ${filePath} (Mode: ${mode || 'auto'}, Queue size: ${this.queue.length})`);
    
    this.emit('queued', queueItem);
    
    // Start processing if not already processing
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process the review queue
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      this.currentReview = item;

      try {
        console.log(`🔍 Processing review: ${item.filePath}`);
        this.emit('reviewStarted', item);
        
        await this.reviewFile(item.filePath, item.workspacePath, item.mode);
        
        console.log(`✅ Review completed: ${item.filePath}`);
        this.emit('reviewCompleted', item);
      } catch (error) {
        console.error(`❌ Review failed for ${item.filePath}:`, error.message);
        this.emit('reviewFailed', item, error);
      } finally {
        this.currentReview = null;
      }
    }

    this.processing = false;
    console.log('✅ Review queue processing complete');
  }

  /**
   * Review a single file
   * @param {string} filePath - Full path to the file
   * @param {string} workspacePath - Workspace root path
   * @param {string|null} mode - Review mode: 'incremental', 'full', or null (auto)
   */
  async reviewFile(filePath, workspacePath, mode = null) {
    await ensureMongoConnection();

    try {
      // Read file content
      const content = readFileSync(filePath, 'utf-8');
      const fileName = filePath.split(/[/\\]/).pop();
      
      // Detect language
      const ext = extname(fileName).toLowerCase();
      const languageMap = {
        '.js': 'javascript', '.jsx': 'javascript',
        '.ts': 'typescript', '.tsx': 'typescript',
        '.py': 'python',
        '.java': 'java',
        '.cpp': 'cpp', '.c': 'c',
        '.go': 'go',
        '.rs': 'rust',
        '.rb': 'ruby',
        '.php': 'php'
      };
      const language = languageMap[ext] || 'text';

      // Check if review already exists for this file (get latest)
      const existingReview = await Review.findOne({ filePath }).sort({ updatedAt: -1 });
      
      // Determine review mode: use provided mode, or auto-detect based on existing review
      let incremental = false;
      let gitDiff = null;
      let changedLines = null;
      
      if (mode === 'incremental') {
        // Force incremental mode
        incremental = true;
        const { parseGitDiff } = await loadServices();
        gitDiff = await getGitDiff(filePath, workspacePath);
        if (gitDiff) {
          changedLines = parseGitDiff(gitDiff);
          console.log(`📝 Found ${changedLines.length} changed lines in git diff`);
        }
      } else if (mode === 'full') {
        // Force full review - skip incremental logic
        incremental = false;
      } else {
        // Auto mode: use incremental if review exists
        if (existingReview) {
          incremental = true;
          const { parseGitDiff } = await loadServices();
          gitDiff = await getGitDiff(filePath, workspacePath);
          if (gitDiff) {
            changedLines = parseGitDiff(gitDiff);
            console.log(`📝 Found ${changedLines.length} changed lines in git diff`);
          }
        }
      }
      
      // Get version number for history
      const latestReview = await Review.findOne({ filePath }).sort({ reviewVersion: -1 });
      const reviewVersion = latestReview ? (latestReview.reviewVersion || 1) + 1 : 1;
      
      // Get workspace custom guidelines
      let customGuidelines = null;
      try {
        const Workspace = (await import('../models/Workspace.js')).default;
        const workspace = await Workspace.findOne({ path: workspacePath });
        if (workspace && workspace.customGuidelines && workspace.customGuidelines.length > 0) {
          customGuidelines = workspace.customGuidelines;
          console.log(`📋 Using ${customGuidelines.length} custom guidelines from workspace`);
        }
      } catch (err) {
        console.warn('Failed to load workspace guidelines:', err.message);
      }
      
      // Create new review document (for history) with 'processing' status
      const reviewData = {
        fileName,
        filePath,
        language,
        codeContent: content,
        status: 'processing',
        incremental: incremental,
        reviewVersion: reviewVersion
      };

      // Preserve applied findings from latest review
      let appliedFindingsMap = new Map();
      if (existingReview && existingReview.findings) {
        existingReview.findings.forEach(f => {
          if (f.applied) {
            const key = `${f.lineNumber || 'general'}-${f.message}`;
            appliedFindingsMap.set(key, f);
          }
        });
      }

      const review = new Review(reviewData);
      await review.save();

      // Generate review using Ollama
      console.log(`🤖 Generating AI review for ${fileName}...`);
      console.log(`   File size: ${content.length} characters`);
      console.log(`   Language: ${language}`);
      console.log(`   ⏳ This may take 1-3 minutes on CPU mode...`);
      
      try {
        const { generateCodeReview } = await loadServices();
        
        // Add progress logging
        console.log(`   Calling Ollama API...`);
        const startTime = Date.now();
        
        // Prepare review options with git diff and custom guidelines if available
        const reviewOptions = {
          incremental: incremental,
          guidelines: customGuidelines,
          changedLines: changedLines
        };
        
        // If incremental and we have changed lines, extract only changed code segments
        let codeToReview = content;
        let lineMapping = null;
        let codeWithOriginalLineNumbers = null;
        if (incremental && changedLines && changedLines.length > 0) {
          const { extractChangedCodeSnippet } = await loadServices();
          const snippet = extractChangedCodeSnippet(content, changedLines, 3); // 3 lines context
          codeToReview = snippet.code;
          lineMapping = snippet.lineMapping;
          codeWithOriginalLineNumbers = snippet.codeWithOriginalLineNumbers;
          console.log(`📝 Incremental review: ${changedLines.length} changed lines, ${snippet.changedLines.length} unique lines`);
          console.log(`📝 Extracted ${codeToReview.split('\n').length} lines (with context) from ${content.split('\n').length} total lines`);
        }
        
        // Update reviewOptions with code for prompt
        if (codeWithOriginalLineNumbers) {
          reviewOptions.codeForPrompt = codeWithOriginalLineNumbers;
        }
        
        const reviewResult = await generateCodeReview(codeToReview, language, reviewOptions);
        
        const duration = Date.now() - startTime;
        const seconds = Math.round(duration / 1000);
        console.log(`   ✅ Ollama responded in ${seconds}s`);

        // Preserve applied findings from existing review
        const mergedFindings = (reviewResult.findings || []).map(newFinding => {
          const key = `${newFinding.lineNumber || 'general'}-${newFinding.message}`;
          const appliedFinding = appliedFindingsMap.get(key);
          
          if (appliedFinding) {
            // Preserve applied status
            return {
              ...newFinding,
              applied: true,
              rejected: appliedFinding.rejected || false
            };
          }
          return newFinding;
        });

        // Update review with results
        review.review = reviewResult.review || 'Review generated successfully';
        review.findings = mergedFindings;
        review.status = 'completed';
        review.tokenUsage = reviewResult.tokenUsage || {};
        review.updatedAt = new Date();

        await review.save();

        console.log(`✅ Review saved: ${review.findings.length} findings`);

        // Emit event with review results
        this.emit('reviewReady', {
          review: review.toObject(),
          filePath,
          workspacePath
        });

        return review;
      } catch (ollamaError) {
        // If Ollama fails, save error but don't fail completely
        const errorMsg = ollamaError.message || 'Unknown error';
        review.review = `Error generating review: ${errorMsg}`;
        review.status = 'failed';
        review.error = errorMsg;
        
        // Check if it's a memory error and provide helpful message
        if (errorMsg.includes('memory') || errorMsg.includes('Memory')) {
          review.error = `${errorMsg}\n\n💡 Suggestion: Try using a smaller model (e.g., codellama:7b or codellama:13b) or free up system memory.`;
        }
        
        await review.save();
        
        // Re-throw so it's handled by the queue processor
        throw new Error(`Ollama review failed: ${errorMsg}`);
      }
    } catch (error) {
      // Update review status to failed (create new failed review entry)
      try {
        const failedReview = await Review.findOne({ filePath }).sort({ updatedAt: -1 });
        if (failedReview && failedReview.status === 'processing') {
          failedReview.status = 'failed';
          failedReview.error = error.message;
          await failedReview.save();
        }
      } catch (saveError) {
        console.error('Failed to save error status:', saveError);
      }

      throw error;
    }
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      currentReview: this.currentReview ? {
        filePath: this.currentReview.filePath,
        status: this.currentReview.status
      } : null
    };
  }

  /**
   * Clear the queue
   */
  clearQueue() {
    this.queue = [];
    console.log('🧹 Review queue cleared');
  }
}

// Export singleton instance
export const reviewQueue = new ReviewQueue();
