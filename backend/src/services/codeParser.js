import fs from 'fs/promises';
import path from 'path';

/**
 * Parse a code file and extract language and content
 * @param {string} filePath - Path to the code file
 * @param {string} fileName - Original filename
 * @returns {Promise<Object>} Parsed code data
 */
export const parseCodeFile = async (filePath, fileName) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const language = detectLanguage(fileName, content);
    
    return {
      content: content,
      language: language,
      fileName: fileName,
      filePath: filePath
    };
  } catch (error) {
    throw new Error(`Failed to parse code file: ${error.message}`);
  }
};

/**
 * Detect programming language from filename and content
 */
const detectLanguage = (fileName, content) => {
  const ext = path.extname(fileName).toLowerCase();
  
  const languageMap = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.c': 'c',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.md': 'markdown',
    '.html': 'html',
    '.css': 'css',
    '.json': 'json',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml'
  };

  return languageMap[ext] || 'text';
};

/**
 * Extract code changes from git diff and return changed line numbers
 * Improved version that handles unified diff format correctly
 */
export const parseGitDiff = (diffText) => {
  const changes = [];
  const lines = diffText.split('\n');
  
  let currentFile = null;
  let currentLineOld = 0;
  let currentLineNew = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect file header
    if (line.startsWith('+++') || line.startsWith('---')) {
      if (line.startsWith('+++')) {
        currentFile = line.substring(4).trim();
      }
      continue;
    }
    
    // Detect line numbers from unified diff format: @@ -old_start,old_count +new_start,new_count @@
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        currentLineOld = parseInt(match[1]);
        currentLineNew = parseInt(match[3]);
        continue;
      }
    }
    
    // Detect added lines (these are the new/changed lines we want to review)
    if (line.startsWith('+') && !line.startsWith('+++')) {
      changes.push({
        file: currentFile,
        lineNumber: currentLineNew, // Use new file line number
        type: 'added',
        content: line.substring(1)
      });
      currentLineNew++;
    } 
    // Detect removed lines (track but don't include in review)
    else if (line.startsWith('-') && !line.startsWith('---')) {
      currentLineOld++;
      // Don't increment newLineNumber for removed lines
    } 
    // Context lines (unchanged)
    else if (!line.startsWith('@@') && !line.startsWith('\\')) {
      currentLineOld++;
      currentLineNew++;
    }
  }
  
  return changes;
};

/**
 * Extract code snippet with only changed lines and context
 * @param {string} fullCode - Full file content
 * @param {Array} changedLines - Array of changed line info from parseGitDiff
 * @param {number} contextLines - Number of context lines before/after (default 3)
 * @returns {Object} - { code: string, lineMapping: Map<snippetLine, originalLine> }
 */
export const extractChangedCodeSnippet = (fullCode, changedLines, contextLines = 3) => {
  if (!changedLines || changedLines.length === 0) {
    return { code: fullCode, lineMapping: new Map() };
  }
  
  const lines = fullCode.split('\n');
  const changedLineNumbers = new Set(changedLines.map(cl => cl.lineNumber));
  
  // Find all lines to include (changed lines + context)
  const linesToInclude = new Set();
  
  changedLineNumbers.forEach(lineNum => {
    // Include context before and after each changed line
    // lineNum is 1-based, convert to 0-based index
    const lineIndex = lineNum - 1;
    for (let i = Math.max(0, lineIndex - contextLines); i < Math.min(lines.length, lineIndex + contextLines + 1); i++) {
      linesToInclude.add(i); // 0-based index
    }
  });
  
  // Create snippet with only relevant lines
  const snippetLines = [];
  const lineMapping = new Map(); // Maps snippet line number to original line number
  
  let snippetLineNum = 1;
  let lastIncludedLine = -1;
  
  Array.from(linesToInclude).sort((a, b) => a - b).forEach((originalIndex) => {
    // Add ellipsis if there's a gap
    if (lastIncludedLine !== -1 && originalIndex - lastIncludedLine > 1) {
      snippetLines.push(`// ... (lines ${lastIncludedLine + 2}-${originalIndex + 1} omitted) ...`);
      snippetLineNum++;
    }
    
    const originalLineNum = originalIndex + 1; // Convert to 1-based
    snippetLines.push(lines[originalIndex]);
    lineMapping.set(snippetLineNum, originalLineNum); // Map snippet line to original line
    snippetLineNum++;
    lastIncludedLine = originalIndex;
  });
  
  return {
    code: snippetLines.join('\n'),
    lineMapping: lineMapping,
    changedLines: Array.from(changedLineNumbers).sort((a, b) => a - b),
    // Helper: create code with original line numbers for LLM prompt
    codeWithOriginalLineNumbers: Array.from(linesToInclude).sort((a, b) => a - b).map((originalIndex) => {
      return `${originalIndex + 1}: ${lines[originalIndex]}`;
    }).join('\n')
  };
};

