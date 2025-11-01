#!/usr/bin/env node

// Pre-commit hook script
// Called by git pre-commit hook to review staged files

const { join } = require('path');
const { pathToFileURL } = require('url');

const appPath = process.argv[2];
const stagedFiles = process.argv.slice(3);

if (!stagedFiles || stagedFiles.length === 0) {
  process.exit(0);
}

// Review each staged file
let hasCriticalIssues = false;

(async () => {
  try {
    // Dynamically import ES modules
    const mongoose = (await import('mongoose')).default;
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/code-review';
    
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
    
    // Import Review model from backend (ES module)
    const reviewModulePath = join(appPath, 'backend/src/models/Review.js');
    const reviewModuleUrl = pathToFileURL(reviewModulePath).href;
    const ReviewModule = await import(reviewModuleUrl);
    const Review = ReviewModule.default;
    
    // Get the git root directory for resolving file paths
    const { execSync } = require('child_process');
    let gitRoot = '';
    try {
      gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
    } catch (e) {
      // Not in a git repo, use current directory
      gitRoot = process.cwd();
    }
    
    for (const file of stagedFiles) {
      try {
        // Resolve relative file paths to absolute paths
        const absolutePath = file.startsWith('/') ? file : join(gitRoot, file);
        
        // Try to find review by absolute path
        let review = await Review.findOne({ filePath: absolutePath });
        
        // If not found, try relative path
        if (!review) {
          review = await Review.findOne({ filePath: file });
        }
        
        // Also try with normalized path separators
        if (!review) {
          const normalizedPath = absolutePath.replace(/\\/g, '/');
          review = await Review.findOne({ filePath: normalizedPath });
        }
        
        if (review && review.findings) {
          const critical = review.findings.some(f => f.severity === 'critical');
          if (critical) {
            console.error(`❌ ${file} has critical issues`);
            hasCriticalIssues = true;
          }
        }
      } catch (error) {
        // If review check fails, allow commit (fail open)
        console.warn(`Warning: Could not check review for ${file}: ${error.message}`);
      }
    }
    
    if (hasCriticalIssues) {
      console.error('\n❌ Pre-commit review failed. Please fix critical issues before committing.');
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    // If anything fails, allow commit (fail open)
    console.warn(`Warning: Pre-commit hook error: ${error.message}`);
    process.exit(0);
  }
})();
