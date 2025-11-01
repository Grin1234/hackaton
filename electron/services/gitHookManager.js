import { existsSync, writeFileSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

const execAsync = promisify(exec);

class GitHookManager {
  async installHook(repoPath) {
    // Check if it's a git repository
    const gitDir = join(repoPath, '.git');
    if (!existsSync(gitDir)) {
      throw new Error('Not a git repository. Please initialize git first (git init).');
    }
    
    // Check if hooks directory exists, create if not
    const hooksDir = join(repoPath, '.git', 'hooks');
    if (!existsSync(hooksDir)) {
      throw new Error('Git hooks directory not found. Git repository may be corrupted.');
    }
    
    const hookPath = join(hooksDir, 'pre-commit');
    const hookScriptPath = join(projectRoot, 'scripts/pre-commit-hook.js');
    
    // Check if hook script exists
    if (!existsSync(hookScriptPath)) {
      throw new Error(`Hook script not found at: ${hookScriptPath}`);
    }
    
    const hookScript = `#!/bin/bash
# AI Code Review Assistant Pre-commit Hook
# This hook reviews staged files before allowing commit

REVIEW_APP_PATH="${projectRoot}"
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
    exit 0
fi

# Call review app to check staged files
node "${hookScriptPath}" "$REVIEW_APP_PATH" $STAGED_FILES

if [ $? -ne 0 ]; then
    echo "Pre-commit review failed. Please fix issues before committing."
    exit 1
fi

exit 0
`;

    try {
      writeFileSync(hookPath, hookScript);
      chmodSync(hookPath, '755');
      return { success: true, hookPath };
    } catch (error) {
      throw new Error(`Failed to install hook: ${error.message}`);
    }
  }

  async checkStagedFiles(repoPath) {
    try {
      const { stdout } = await execAsync(`cd "${repoPath}" && git diff --cached --name-only --diff-filter=ACM`);
      const stagedFiles = stdout.trim().split('\n').filter(f => f);
      
      // Import reviewQueue dynamically
      const { reviewQueue } = await import('./reviewQueue.js');
      
      const reviews = [];
      for (const file of stagedFiles) {
        const fullPath = join(repoPath, file);
        const review = await reviewQueue.getReview(fullPath);
        if (review) {
          reviews.push({
            file,
            review,
            hasCriticalIssues: review.findings && review.findings.some(f => f.severity === 'critical')
          });
        }
      }

      return reviews;
    } catch (error) {
      throw new Error(`Failed to check staged files: ${error.message}`);
    }
  }

  async commitWithReview(repoPath, message) {
    // Import reviewQueue dynamically
    const { reviewQueue } = await import('./reviewQueue.js');
    
    // Check staged files first
    const reviews = await this.checkStagedFiles(repoPath);
    
    const criticalIssues = reviews.filter(r => r.hasCriticalIssues);
    if (criticalIssues.length > 0) {
      throw new Error(`Cannot commit: ${criticalIssues.length} file(s) have critical issues`);
    }

    // Review all staged files before commit
    for (const review of reviews) {
      const fullPath = join(repoPath, review.file);
      await reviewQueue.queueFile(fullPath, repoPath, { priority: 'high' });
    }

    // Wait for reviews to complete (with timeout)
    await this.waitForReviews(reviews.map(r => join(repoPath, r.file)), 30000);

    // Perform commit
    try {
      await execAsync(`cd "${repoPath}" && git commit -m "${message}"`);
      return { success: true };
    } catch (error) {
      throw new Error(`Commit failed: ${error.message}`);
    }
  }

  async waitForReviews(filePaths, timeout = 30000) {
    const { reviewQueue } = await import('./reviewQueue.js');
    
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const allReviewed = await Promise.all(
        filePaths.map(async (path) => {
          const review = await reviewQueue.getReview(path);
          return review && review.status === 'completed';
        })
      );

      if (allReviewed.every(v => v)) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

export const gitHookManager = new GitHookManager();
