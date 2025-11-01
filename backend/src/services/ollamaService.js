import axios from 'axios';
import dotenv from 'dotenv';
import { applyRuleBasedFix, shouldUseRuleBasedFix } from './ruleBasedFixes.js';

dotenv.config();

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'codellama';

// Guidelines configuration
const GUIDELINES = {
  python: ['PEP8', 'Google Python Style Guide'],
  javascript: ['Google JavaScript Style Guide', 'Airbnb Style Guide'],
  typescript: ['TypeScript Style Guide'],
  java: ['Google Java Style Guide'],
  cpp: ['Google C++ Style Guide'],
  default: ['General Best Practices']
};

/**
 * Get applicable guidelines for a language
 */
const getGuidelinesForLanguage = (language) => {
  const lang = language.toLowerCase();
  if (lang.includes('python')) return GUIDELINES.python;
  if (lang.includes('javascript') || lang.includes('js')) return GUIDELINES.javascript;
  if (lang.includes('typescript') || lang.includes('ts')) return GUIDELINES.typescript;
  if (lang.includes('java')) return GUIDELINES.java;
  if (lang.includes('cpp') || lang.includes('c++')) return GUIDELINES.cpp;
  return GUIDELINES.default;
};

/**
 * Extract line number from code snippet by matching it against code content
 * @param {string} codeSnippet - The code snippet mentioned in finding
 * @param {string} codeContent - Full code content
 * @returns {number|null} Line number if found, null otherwise
 */
const extractLineNumberFromCode = (codeSnippet, codeContent) => {
  if (!codeSnippet || !codeContent) return null;
  
  // Clean the snippet - remove quotes, extra whitespace
  const cleanedSnippet = codeSnippet.trim()
    .replace(/^["'`]+|["'`]+$/g, '') // Remove surrounding quotes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  if (!cleanedSnippet || cleanedSnippet.length < 5) return null;
  
  const lines = codeContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Check if the snippet is contained in this line
    if (line.includes(cleanedSnippet) || cleanedSnippet.includes(line)) {
      return i + 1; // Line numbers are 1-based
    }
    // Also check for partial matches (keywords)
    const snippetKeywords = cleanedSnippet.split(/\s+/).filter(w => w.length > 3);
    if (snippetKeywords.length > 0 && snippetKeywords.every(keyword => line.includes(keyword))) {
      return i + 1;
    }
  }
  
  return null;
};

/**
 * Rule-based security vulnerability detection (runs before LLM)
 * This catches common vulnerabilities that LLM might miss
 * @param {string} codeContent - The code to analyze
 * @param {string} language - Programming language
 * @returns {Array} Array of findings
 */
const detectSecurityVulnerabilities = (codeContent, language) => {
  const findings = [];
  
  if (!codeContent || typeof codeContent !== 'string') {
    return findings;
  }
  
  // Only check C/C++ code for buffer overflows
  if (language.toLowerCase() !== 'c' && language.toLowerCase() !== 'cpp' && 
      language.toLowerCase() !== 'c++' && !language.toLowerCase().includes('c')) {
    return findings;
  }
  
  const lines = codeContent.split('\n');
  const bufferDeclarations = new Map(); // Map to track buffer sizes
  
  // First pass: Find buffer declarations
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Match: char buffer[10]; or char buffer[10] = ...;
    const bufferMatch = line.match(/char\s+(\w+)\s*\[\s*(\d+)\s*\]/);
    if (bufferMatch) {
      const bufferName = bufferMatch[1];
      const bufferSize = parseInt(bufferMatch[2]);
      bufferDeclarations.set(bufferName, { size: bufferSize, line: i + 1 });
    }
  }
  
  // Second pass: Check for unsafe operations
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;
    
    // Check for strcpy(buffer, source) - always unsafe
    const strcpyMatch = line.match(/strcpy\s*\(\s*(\w+)\s*,\s*(["']([^"']+)["']|\w+)/);
    if (strcpyMatch) {
      const bufferName = strcpyMatch[1];
      const sourceString = strcpyMatch[3] || ''; // Get string literal if present
      const bufferInfo = bufferDeclarations.get(bufferName);
      
      if (bufferInfo) {
        // Check if source is a string literal and compare lengths
        if (sourceString && sourceString.length >= bufferInfo.size) {
          findings.push({
            lineNumber: lineNum,
            severity: 'critical',
            category: 'security',
            message: `Buffer Overflow Vulnerability: strcpy operation does not check buffer bounds`,
            impact: 'Unsafe string operation can cause memory corruption',
            suggestion: 'Use bounded string functions to prevent buffer overflow',
            guidelines: getGuidelinesForLanguage(language)
          });
        } else {
          // Still warn even if source appears shorter or is a variable (could be dynamic)
          findings.push({
            lineNumber: lineNum,
            severity: 'critical',
            category: 'security',
            message: `Buffer Overflow Vulnerability: strcpy does not check buffer bounds`,
            impact: 'Unsafe string operation can cause memory corruption',
            suggestion: 'Use bounded string functions to prevent buffer overflow',
            guidelines: getGuidelinesForLanguage(language)
          });
        }
      } else {
        // Buffer not found in declarations, but strcpy is still unsafe
        findings.push({
          lineNumber: lineNum,
          severity: 'high',
          category: 'security',
          message: `Unsafe strcpy usage: strcpy does not check buffer bounds`,
          impact: 'Unsafe string operation can cause memory corruption',
          suggestion: 'Use bounded string functions to prevent buffer overflow',
          guidelines: getGuidelinesForLanguage(language)
        });
      }
    }
    
    // Check for gets() - always unsafe
    if (line.includes('gets(')) {
      findings.push({
        lineNumber: lineNum,
        severity: 'critical',
        category: 'security',
        message: 'Buffer Overflow Vulnerability: gets() function is unsafe',
        impact: 'Unsafe string operation can cause memory corruption',
        suggestion: 'Use bounded input functions to prevent buffer overflow',
        guidelines: getGuidelinesForLanguage(language)
      });
    }
    
    // Check for strcat without bounds checking
    const strcatMatch = line.match(/strcat\s*\(\s*(\w+)\s*,\s*["']([^"']+)["']/);
    if (strcatMatch) {
      const bufferName = strcatMatch[1];
      const bufferInfo = bufferDeclarations.get(bufferName);
      if (bufferInfo) {
        findings.push({
          lineNumber: lineNum,
          severity: 'high',
          category: 'security',
          message: `Potential Buffer Overflow: strcat does not check buffer bounds`,
          impact: 'Unsafe string operation can cause memory corruption',
          suggestion: 'Use bounded string functions to prevent buffer overflow',
          guidelines: getGuidelinesForLanguage(language)
        });
      }
    }
    
    // Check for sprintf without size limits
    if (line.includes('sprintf(') && !line.includes('snprintf')) {
      findings.push({
        lineNumber: lineNum,
        severity: 'high',
        category: 'security',
        message: 'Potential Buffer Overflow: sprintf() does not check buffer bounds',
        impact: 'Unsafe string operation can cause memory corruption',
        suggestion: 'Use bounded string functions to prevent buffer overflow',
        guidelines: getGuidelinesForLanguage(language)
      });
    }
    
    // Check for scanf("%s", buffer) without field width
    if (line.match(/scanf\s*\([^)]*["']%s["'][^)]*\)/)) {
      findings.push({
        lineNumber: lineNum,
        severity: 'critical',
        category: 'security',
        message: 'Buffer Overflow Vulnerability: scanf("%s") without field width is unsafe',
        impact: 'Unsafe string operation can cause memory corruption',
        suggestion: 'Use bounded input functions to prevent buffer overflow',
        guidelines: getGuidelinesForLanguage(language)
      });
    }
  }
  
  if (findings.length > 0) {
    console.log(`[detectSecurityVulnerabilities] Found ${findings.length} security vulnerabilities using rule-based detection`);
  }
  
  return findings;
};

/**
 * Generate a code review using Ollama with enhanced features
 * @param {string} codeContent - The code to review
 * @param {string} language - Programming language
 * @param {Object} options - Review options
 * @param {boolean} options.incremental - Whether this is an incremental review
 * @param {Array} options.guidelines - Custom guidelines to apply
 * @returns {Promise<Object>} Review result with findings and review text
 */
export const generateCodeReview = async (codeContent, language = 'unknown', options = {}) => {
  try {
    const { incremental = false, guidelines = null } = options;
    
    // Build prompt for code review with guidelines and modular evaluation
    const prompt = buildReviewPrompt(codeContent, language, { incremental, guidelines });
    
    console.log(`[Ollama] Requesting review for ${language} code (${codeContent.length} chars)`);
    console.log(`[Ollama] Model: ${OLLAMA_MODEL}, URL: ${OLLAMA_API_URL}`);
    
    // Call Ollama API with timeout
    const startTime = Date.now();
    
    // Limit prompt size if too large (models have context limits)
    // Increased limit to allow full code analysis
    const maxPromptLength = 8000; // Increased to allow full code review
    const truncatedPrompt = prompt.length > maxPromptLength 
      ? prompt.substring(0, maxPromptLength) + '\n\n[... code truncated for review ...]'
      : prompt;
    
    if (prompt.length > maxPromptLength) {
      console.log(`[Ollama] Prompt truncated from ${prompt.length} to ${maxPromptLength} chars`);
    }
    
    console.log(`[Ollama] Sending request to Ollama (this may take 1-3 minutes on CPU)...`);
    console.log(`[Ollama] Prompt length: ${prompt.length} chars, Code length: ${codeContent.length} chars`);
    
    const response = await axios.post(`${OLLAMA_API_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: truncatedPrompt,
      stream: false,
      options: {
        temperature: 0.2, // Lower temperature for more focused, accurate detection
        top_p: 0.9,
        num_predict: 1000 // Increased response length to allow multiple findings
      }
    }, {
      timeout: 300000, // 5 minutes timeout for CPU inference (CPU is slow)
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const duration = Date.now() - startTime;
    console.log(`[Ollama] Response received in ${duration}ms`);

    const reviewText = response.data.response || '';
    
    // Extract brief summary (first line or first 10 words)
    let summaryText = '';
    const summaryMatch = reviewText.match(/Summary[:\-]?\s*(.+?)(?:\n|$)/i);
    if (summaryMatch) {
      summaryText = summaryMatch[1].trim();
      // Limit to 10 words
      const words = summaryText.split(/\s+/);
      summaryText = words.slice(0, 10).join(' ');
    } else {
      // Try to extract first meaningful sentence (up to 10 words)
      const firstLine = reviewText.split('\n')[0].trim();
      const words = firstLine.split(/\s+/).filter(w => w.length > 0 && !w.match(/^\d+\.$/));
      if (words.length > 0) {
        summaryText = words.slice(0, 10).join(' ');
      }
    }
    
    // Parse the review to extract structured findings
    const llmFindings = parseReviewFindings(reviewText, language, codeContent); // Use original text for parsing
    
    // Run rule-based security detection (catches issues LLM might miss)
    const ruleBasedFindings = detectSecurityVulnerabilities(codeContent, language);
    
    // Merge findings, avoiding duplicates
    const allFindings = [...ruleBasedFindings];
    const existingLineNumbers = new Set(ruleBasedFindings.map(f => f.lineNumber));
    
    for (const llmFinding of llmFindings) {
      // Add LLM finding if it's not a duplicate (same line number and similar message)
      const isDuplicate = existingLineNumbers.has(llmFinding.lineNumber) && 
        allFindings.some(f => 
          f.lineNumber === llmFinding.lineNumber && 
          f.message.toLowerCase().includes(llmFinding.message.toLowerCase().substring(0, 20))
        );
      
      if (!isDuplicate) {
        allFindings.push(llmFinding);
        existingLineNumbers.add(llmFinding.lineNumber);
      }
    }
    
    console.log(`[generateCodeReview] Total findings: ${allFindings.length} (${ruleBasedFindings.length} rule-based, ${llmFindings.length} from LLM)`);
    
    // Generate summary from findings if not extracted from LLM response
    if (!summaryText || summaryText.length === 0) {
      const criticalCount = allFindings.filter(f => f.severity === 'critical').length;
      const highCount = allFindings.filter(f => f.severity === 'high').length;
      const totalCount = allFindings.length;
      
      if (totalCount === 0) {
        summaryText = 'No security issues detected';
      } else if (criticalCount > 0) {
        summaryText = 'Critical security vulnerabilities found';
      } else if (highCount > 0) {
        summaryText = 'High priority issues identified';
      } else {
        summaryText = 'Minor issues require attention';
      }
    }
    
    // Use summary as the review text (brief, 10 words max)
    let cleanReviewText = summaryText;
    
    // Add effort estimation for each finding
    const findingsWithEffort = allFindings.map(finding => ({
      ...finding,
      effortEstimation: estimateEffort(finding)
    }));
    
    return {
      review: cleanReviewText,
      findings: findingsWithEffort,
      tokenUsage: {
        promptTokens: estimateTokens(prompt),
        completionTokens: estimateTokens(reviewText),
        totalTokens: estimateTokens(prompt) + estimateTokens(reviewText)
      }
    };
  } catch (error) {
    console.error('[Ollama] API error:', error.message);
    console.error('[Ollama] Error details:', {
      code: error.code,
      response: error.response?.data,
      status: error.response?.status
    });
    
    // Extract error message from response if available
    let errorMessage = error.message;
    if (error.response && error.response.data) {
      if (error.response.data.error) {
        errorMessage = error.response.data.error;
      } else if (typeof error.response.data === 'string') {
        errorMessage = error.response.data;
      }
    }
    
    // Check for timeout
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorMessage = 'Request timed out. The model may be too slow or the prompt too large. Try a smaller file or wait for the model to finish loading.';
    }
    
    throw new Error(`Failed to generate review: ${errorMessage}`);
  }
};

/**
 * Build a prompt for code review focusing ONLY on security and performance
 * Do NOT report syntax errors, style issues, or linting problems
 */
const buildReviewPrompt = (codeContent, language, options = {}) => {
  const { incremental = false, guidelines = null, changedLines = null, codeForPrompt = null } = options;
  
  let prompt = `You are an expert security and performance code reviewer. ${incremental ? '**INCREMENTAL REVIEW MODE**: You are reviewing ONLY newly added or changed code segments. Focus your analysis on the changes shown below.' : ''} Analyze this ${language} code and provide insights ONLY about security vulnerabilities and performance issues.

**CRITICAL: DO NOT REPORT:**
- Syntax errors (these are compiler/linter issues)
- Style violations (indentation, spacing, naming conventions)
- Code formatting issues
- Missing semicolons, brackets, etc.
- Linting errors

**IMPORTANT:** Even if the code has syntax errors, analyze the code structure and logic that you CAN understand for security and performance issues. Focus on what the code is trying to do, not whether it compiles.

**CRITICAL SECURITY PATTERNS TO DETECT:**
For C/C++ code, ALWAYS check for:
- strcpy(buffer, source) where source length > buffer size → BUFFER OVERFLOW
- strcat(buffer, source) without checking buffer bounds → BUFFER OVERFLOW
- gets(buffer) → BUFFER OVERFLOW (always unsafe)
- sprintf(buffer, format, ...) without size limits → BUFFER OVERFLOW
- scanf("%s", buffer) without field width → BUFFER OVERFLOW
- memcpy/strncpy without proper bounds checking
- Array access without bounds checking (e.g., array[index] where index might be out of bounds)
- Pointer arithmetic that could go out of bounds

Example: If you see "char buffer[10]; strcpy(buffer, \"long string\");" → This is a CRITICAL buffer overflow vulnerability on the strcpy line.

**ONLY REPORT:**
1. **Security Vulnerabilities**: 
   - SQL injection risks
   - XSS vulnerabilities
   - Authentication/authorization flaws
   - Insecure data handling
   - Cryptographic weaknesses
   - Input validation issues
   - Sensitive data exposure
   - Insecure dependencies
   - Race conditions
   - Path traversal vulnerabilities
   - **Buffer overflows** (CRITICAL: Look for unsafe C functions like strcpy, strcat, gets, sprintf, scanf without bounds checking)
   - **Stack overflow** (when copying data larger than buffer size)
   - **Heap overflow** (when allocating/reallocating memory incorrectly)
   - Unsafe string operations (strcpy, strcat, gets, sprintf with unbounded strings)
   - Uninitialized variable usage that could lead to security issues
   - Memory corruption risks
   - Use-after-free vulnerabilities
   - Double-free vulnerabilities
   - Format string vulnerabilities

2. **Performance Issues**:
   - Inefficient algorithms (O(n²) when O(n) is possible)
   - Memory leaks
   - Unnecessary computations in loops
   - Missing database indexes
   - N+1 query problems
   - Inefficient data structures
   - Blocking operations
   - Unoptimized rendering
   - Large object allocations
   - Excessive API calls
   - Unused variables that waste memory
   - Inefficient memory usage patterns

3. **Documentation Updates**:
   - Missing or incomplete function/method documentation
   - Missing parameter descriptions
   - Missing return value documentation
   - Missing code comments for complex logic
   - Missing README updates for new features
   - Outdated documentation comments
   - Missing error handling documentation
   - Missing usage examples
   - Missing type information in comments
   - Missing edge case documentation

**Output Format - STRICT REQUIREMENT:**

FIRST, provide a BRIEF SUMMARY (maximum 10 words) describing the overall security, performance, and documentation status. Examples:
- "Critical buffer overflow vulnerabilities found"
- "No security issues detected"
- "Performance optimization opportunities identified"
- "Multiple security vulnerabilities require attention"
- "Documentation updates recommended"

Then, for EACH finding, use this exact format:

1. **Issue Title** (brief, general description)
   Line Number: [NUMBER] (REQUIRED - must be a valid line number from the code)
   Severity: [critical|high|medium|low]
   Category: [security|performance|documentation]
   Impact: [brief general description - 1-2 sentences max]
   Suggestion: [brief general recommendation - 1-2 sentences max]

CRITICAL: 
- The summary MUST be maximum 10 words
- Keep descriptions GENERAL and CONCISE - avoid excessive technical details
- Line Number MUST be a valid number from the code (1, 2, 3, etc.)
- If you cannot determine the exact line number, DO NOT report the finding
- DO NOT use "N/A", "unknown", or any placeholder for line numbers
- Each finding MUST start with "1.", "2.", "3." etc.
- Format MUST be consistent and parseable
- Impact and Suggestion should be HIGH-LEVEL summaries, not detailed technical specifications

**IMPORTANT:**
- If you cannot identify a specific line number, DO NOT report the finding
- DO NOT report "N/A" or "as this is a syntax error" - these are not security/performance issues
- Only report actual security vulnerabilities or performance problems with valid line numbers
- If the code only has syntax errors and no security/performance issues, respond with: "No security vulnerabilities or performance issues identified in this code."
- ALWAYS include the line number in the format "Line Number: X" where X is a number

${guidelines && guidelines.length > 0 ? `**CUSTOM GUIDELINES TO APPLY:**
${guidelines.map((g, i) => `${i + 1}. ${g}`).join('\n')}

` : ''}${incremental ? `**INCREMENTAL REVIEW MODE - IMPORTANT:**
- You are reviewing ONLY the changed/newly added code segments shown below
- The code snippet includes context lines (unchanged code) for reference
- Lines marked with "// ... (lines X-Y omitted) ..." are unchanged code that was skipped
- Focus your analysis ONLY on the changed lines (newly added or modified code)
- **CRITICAL**: The line numbers shown in the code snippet (before the colon) are the ORIGINAL file line numbers
- Report findings using these ORIGINAL line numbers - they correspond to the actual line numbers in the full file
- Example: If the snippet shows "45: strcpy(buffer, input);", report "Line Number: 45" (not line 1 or 2 of the snippet)

**Changed Lines Summary:**
${changedLines && changedLines.length > 0 ? changedLines.map((cl, i) => `- Line ${cl.lineNumber}: ${cl.type === 'added' ? 'Added' : 'Modified'} - "${cl.content?.substring(0, 60)}..."`).join('\n') : 'No specific changed lines identified'}

` : ''}**Code to review (with line numbers):**
\`\`\`${language}
${options.codeForPrompt ? options.codeForPrompt : codeContent.split('\n').map((line, idx) => `${idx + 1}: ${line}`).join('\n')}
\`\`\`

**ANALYSIS INSTRUCTIONS:**
1. Read the code line by line
2. For each line, check if it contains security vulnerabilities (especially buffer overflows, unsafe functions)
3. Identify the EXACT line number where the vulnerability exists
4. If you find strcpy, strcat, gets, sprintf, scanf, or similar unsafe functions, this is ALWAYS a security issue
5. Compare buffer sizes with data being copied (e.g., buffer[10] vs copying 50+ characters)
6. Report EVERY security vulnerability you find, even if there are multiple

**IMPORTANT:** The code above includes line numbers. When reporting findings, use the exact line number from the code above (e.g., if the issue is on line 5, use "Line Number: 5").

**EXAMPLE OUTPUT FORMAT:**

Summary: Critical buffer overflow vulnerabilities found

1. **Buffer Overflow Vulnerability**
   Line Number: 5
   Severity: critical
   Category: security
   Impact: Unsafe string operation can cause memory corruption
   Suggestion: Use bounded string functions to prevent buffer overflow

Keep descriptions brief and general. Focus on what's wrong, not implementation details.

Provide your review with structured findings focusing on security, performance, and documentation updates. Be thorough and report ALL issues you find:`;

  return prompt;
};

const parseReviewFindings = (reviewText, language, codeContent = '') => {
  const findings = [];
  
  if (!reviewText || typeof reviewText !== 'string') {
    return findings;
  }
  
  console.log(`[parseReviewFindings] Parsing review text (${reviewText.length} chars)`)
  
  // Multiple parsing strategies to catch different formats
  // Strategy 1: Standard format with "Line Number: X"
  const standardPattern = /(\d+)\.\s*\*\*([^*]+)\*\*[\s\S]*?Line\s+Number[:\-]\s*(\d+(?:\s*-\s*\d+)?)[\s\S]*?Severity[:\-]\s*(critical|high|medium|low|Critical|High|Medium|Low)[\s\S]*?Category[:\-]\s*(security|performance|documentation|Security|Performance|Documentation)(?:[\s\S]*?Impact[:\-]\s*([^\n]+(?:\n(?!\d+\.)[^\n]+)*))?(?:[\s\S]*?Suggestion[:\-]\s*([^\n]+(?:\n(?!\d+\.)[^\n]+)*))?/gi;
  
  // Strategy 2: Alternative formats like "Line X:", "at line X", etc.
  const alternativePatterns = [
    /(\d+)\.\s*\*\*([^*]+)\*\*[\s\S]*?Line\s+(\d+)[:\-]/gi,
    /(\d+)\.\s*\*\*([^*]+)\*\*[\s\S]*?line\s+(\d+)[:\-]/gi,
    /(\d+)\.\s*\*\*([^*]+)\*\*[\s\S]*?at\s+line\s+(\d+)/gi,
    /(\d+)\.\s*\*\*([^*]+)\*\*[\s\S]*?\(Line\s+(\d+)\)/gi,
  ];
  
  let match;
  const originalText = reviewText;
  const processedMatches = new Set();
  
  // First, try standard format
  while ((match = standardPattern.exec(originalText)) !== null) {
    const fullMatch = match[0];
    const index = match.index;
    const title = match[2].trim();
    const lineNumberStr = match[3] || '';
    const severity = match[4] ? match[4].toLowerCase() : 'medium';
    const category = match[5] ? match[5].toLowerCase() : null;
    const impact = match[6] ? match[6].trim().replace(/\s+/g, ' ').trim() : '';
    let suggestion = match[7] ? match[7].trim().replace(/\s+/g, ' ').trim() : '';
    
    // Skip if already processed
    if (processedMatches.has(index)) continue;
    processedMatches.add(index);
    
    console.log(`[parseReviewFindings] Found standard match:`, {
      title: title.substring(0, 50),
      lineNumberStr,
      severity,
      category
    });
    
    // Skip if mentions syntax errors
    if (title.toLowerCase().includes('syntax error') || 
        suggestion.toLowerCase().includes('syntax error') ||
        suggestion.toLowerCase().includes('fix the syntax')) {
      console.log(`[parseReviewFindings] Skipping - mentions syntax error`);
      continue;
    }
    
    // Only process security or performance findings
    if (!category || (category !== 'security' && category !== 'performance')) {
      console.log(`[parseReviewFindings] Skipping - category is ${category}`);
      continue;
    }
    
    // Extract line number - handle ranges like "32-40" -> use first number (32)
    let lineNumber = null;
    if (lineNumberStr) {
      const firstNumMatch = lineNumberStr.match(/^(\d+)/);
      if (firstNumMatch) {
        lineNumber = parseInt(firstNumMatch[1]);
        if (isNaN(lineNumber) || lineNumber <= 0) {
          lineNumber = null;
        }
      }
    }
    
    // If still no line number, try to extract from code snippet in title or suggestion
    if (!lineNumber && codeContent) {
      const codeSnippet = title.match(/`([^`]+)`/) || suggestion.match(/`([^`]+)`/) || fullMatch.match(/`([^`]+)`/);
      if (codeSnippet && codeSnippet[1]) {
        lineNumber = extractLineNumberFromCode(codeSnippet[1], codeContent);
        if (lineNumber) {
          console.log(`[parseReviewFindings] Extracted line number ${lineNumber} from code snippet: ${codeSnippet[1].substring(0, 30)}`);
        }
      }
    }
    
    // Only add if we have a valid line number
    if (lineNumber && lineNumber > 0) {
      findings.push({
        lineNumber: lineNumber,
        severity: ['critical', 'high', 'medium', 'low'].includes(severity) ? severity : 'medium',
        category: category,
        message: title,
        impact: impact,
        suggestion: suggestion,
        guidelines: getGuidelinesForLanguage(language)
      });
    } else {
      console.log(`[parseReviewFindings] Skipping finding without valid line number: ${title.substring(0, 50)}`);
    }
  }
  
  // Try alternative patterns if standard format didn't find all findings
  for (const altPattern of alternativePatterns) {
    let altMatch;
    while ((altMatch = altPattern.exec(originalText)) !== null) {
      const index = altMatch.index;
      if (processedMatches.has(index)) continue;
      
      const title = altMatch[2].trim();
      const lineNumberStr = altMatch[3] || '';
      
      // Check if this finding already exists
      const existingFinding = findings.find(f => 
        f.message === title && f.lineNumber === parseInt(lineNumberStr)
      );
      if (existingFinding) continue;
      
      // Extract the context around this match to find severity and category
      const contextStart = Math.max(0, index - 500);
      const contextEnd = Math.min(originalText.length, index + 1000);
      const context = originalText.substring(contextStart, contextEnd);
      
      // Try to extract severity and category from context
      const severityMatch = context.match(/Severity[:\-]\s*(critical|high|medium|low|Critical|High|Medium|Low)/i);
      const categoryMatch = context.match(/Category[:\-]\s*(security|performance|Security|Performance)/i);
      
      const severity = severityMatch ? severityMatch[1].toLowerCase() : 'medium';
      const category = categoryMatch ? categoryMatch[1].toLowerCase() : null;
      
      // Extract impact and suggestion from context
      const impactMatch = context.match(/Impact[:\-]\s*([^\n]+(?:\n(?!\d+\.)[^\n]+)*)/i);
      const suggestionMatch = context.match(/Suggestion[:\-]\s*([^\n]+(?:\n(?!\d+\.)[^\n]+)*)/i);
      
      const impact = impactMatch ? impactMatch[1].trim().replace(/\s+/g, ' ').trim() : '';
      const suggestion = suggestionMatch ? suggestionMatch[1].trim().replace(/\s+/g, ' ').trim() : '';
      
      // Skip if mentions syntax errors
      if (title.toLowerCase().includes('syntax error') || 
          suggestion.toLowerCase().includes('syntax error') ||
          suggestion.toLowerCase().includes('fix the syntax')) {
        continue;
      }
      
      // Only process security or performance findings
      if (!category || (category !== 'security' && category !== 'performance')) {
        continue;
      }
      
      let lineNumber = parseInt(lineNumberStr);
      
      // If still no line number, try to extract from code snippet in title or suggestion
      if ((isNaN(lineNumber) || lineNumber <= 0) && codeContent) {
        const codeSnippet = title.match(/`([^`]+)`/) || suggestion.match(/`([^`]+)`/);
        if (codeSnippet && codeSnippet[1]) {
          lineNumber = extractLineNumberFromCode(codeSnippet[1], codeContent);
        }
      }
      
      if (!isNaN(lineNumber) && lineNumber > 0) {
        processedMatches.add(index);
        findings.push({
          lineNumber: lineNumber,
          severity: ['critical', 'high', 'medium', 'low'].includes(severity) ? severity : 'medium',
          category: category,
          message: title,
          impact: impact,
          suggestion: suggestion,
          guidelines: getGuidelinesForLanguage(language)
        });
      }
    }
  }
  
  // Final validation: remove any findings without line numbers
  const validFindings = findings.filter(f => f.lineNumber && typeof f.lineNumber === 'number' && f.lineNumber > 0);
  
  // Log any findings that were filtered out
  const filteredOut = findings.length - validFindings.length;
  if (filteredOut > 0) {
    console.log(`[parseReviewFindings] Filtered out ${filteredOut} findings without valid line numbers`);
  }
  
  console.log(`[parseReviewFindings] Extracted ${validFindings.length} valid findings (${findings.length} total before validation)`)
  if (validFindings.length > 0) {
    console.log(`[parseReviewFindings] Sample finding:`, JSON.stringify(validFindings[0], null, 2))
  }
  
  return validFindings;
};

/**
 * Generate a chat reply from the LLM
 * @param {string} codeContent - The full code content
 * @param {string} language - Programming language
 * @param {string} userMessage - The user's message/question
 * @param {Array} chatHistory - Previous messages in the conversation
 * @param {Array} findings - All findings in the review
 * @returns {Promise<string>} LLM-generated reply
 */
export const generateChatReply = async (codeContent, language, userMessage, chatHistory = [], findings = []) => {
  try {
    // Build prompt for chat reply
    const prompt = buildChatPrompt(codeContent, language, userMessage, chatHistory, findings);
    
    console.log(`[Ollama] Generating chat reply for ${language} code`);
    
    const response = await axios.post(`${OLLAMA_API_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.7, // Conversational temperature
        top_p: 0.9,
        num_predict: 800 // Reasonable length for a chat reply
      }
    }, {
      timeout: 120000, // 2 minutes timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const replyText = response.data.response || '';
    const cleanedReply = replyText.trim();
    
    if (!cleanedReply) {
      throw new Error('Empty response from LLM');
    }
    
    console.log(`[Ollama] Generated chat reply (${cleanedReply.length} chars)`);
    return cleanedReply;
  } catch (error) {
    console.error('[Ollama] Error generating chat reply:', error.message);
    throw new Error(`Failed to generate reply: ${error.message}`);
  }
};

/**
 * Build a prompt for chat conversation
 */
const buildChatPrompt = (codeContent, language, userMessage, chatHistory = [], findings = []) => {
  // Include relevant code context (first 500 lines or specific sections if mentioned)
  const codePreview = codeContent.split('\n').slice(0, 500).join('\n');
  
  let prompt = `You are an expert code reviewer assistant helping a developer understand and improve their code. You are reviewing ${language} code.

**Code Context:**
\`\`\`${language}
${codePreview}
\`\`\`

`;

  if (findings.length > 0) {
    prompt += `**Review Findings:**
${findings.slice(0, 20).map((f, i) => `- Line ${f.lineNumber}: ${f.severity} ${f.category} - ${f.message}`).join('\n')}

`;
  }

  if (chatHistory.length > 0) {
    prompt += `**Previous Conversation:**
${chatHistory.slice(-6).map(msg => `${msg.role === 'user' ? 'Developer' : 'Assistant'}: ${msg.content}`).join('\n')}

`;
  }

  prompt += `**Developer's Question/Comment:**
"${userMessage}"

**Your Task:**
Provide a helpful, conversational reply. You should:
- Answer the question directly and clearly
- Reference specific code lines or findings when relevant
- Be conversational and helpful (like a colleague helping another)
- Keep your reply concise but complete (2-5 sentences typically)
- If asked about a finding, explain why it's important and how to fix it
- If asked about code improvements, provide specific suggestions

**Your Reply:**`;

  return prompt;
};

/**
 * Estimate effort required to fix a finding
 */
const estimateEffort = (finding) => {
  const { severity, category, suggestion } = finding;
  
  // Critical security issues usually require high effort
  if (severity === 'critical' && category === 'security') {
    return 'high';
  }
  
  // Simple style fixes are trivial
  if (category === 'style' && suggestion && suggestion.length < 50) {
    return 'trivial';
  }
  
  // Architecture issues usually require high effort
  if (category === 'architecture') {
    return 'high';
  }
  
  // Performance optimizations vary
  if (category === 'performance') {
    return severity === 'critical' ? 'high' : 'medium';
  }
  
  // Severity-based estimation
  if (severity === 'critical') return 'high';
  if (severity === 'high') return 'medium';
  if (severity === 'low') return 'trivial';
  
  return 'medium';
};

/**
 * Estimate token count (rough approximation)
 */
const estimateTokens = (text) => {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
};

/**
 * Generate actual code fix using Ollama
 * @param {string} codeContent - The original code
 * @param {string} language - Programming language
 * @param {Object} finding - The finding object with lineNumber, message, and suggestion
 * @returns {Promise<string>} The fixed code content
 */
export const generateCodeFix = async (codeContent, language, finding) => {
  try {
    const lines = codeContent.split('\n');
    
    // Get the actual line that needs fixing
    const targetLineIndex = (finding.lineNumber || 1) - 1;
    if (targetLineIndex < 0 || targetLineIndex >= lines.length) {
      throw new Error(`Invalid line number: ${finding.lineNumber}`);
    }
    
    const originalLine = lines[targetLineIndex];
    
    // First, try rule-based fixes (fast, deterministic)
    if (shouldUseRuleBasedFix(finding)) {
      console.log(`[RuleBased] Attempting rule-based fix for line ${finding.lineNumber}...`);
      const ruleBasedFix = applyRuleBasedFix(codeContent, language, finding);
      if (ruleBasedFix) {
        console.log(`[RuleBased] Applied rule-based fix: ${ruleBasedFix === '__REMOVE_LINE__' ? 'REMOVE_LINE' : ruleBasedFix}`);
        return ruleBasedFix;
      }
      console.log(`[RuleBased] No rule-based fix found, falling back to LLM...`);
    }
    
    // Check if suggestion is about removing a line
    const suggestion = finding.suggestion.trim().toLowerCase();
    const isRemoveOperation = suggestion.includes('remove') || 
                               suggestion.includes('delete') ||
                               suggestion.includes('eliminate') ||
                               suggestion.includes('delete this line') ||
                               suggestion.includes('remove this line') ||
                               suggestion.includes('remove duplicate');
    
    if (isRemoveOperation) {
      // Return special marker to indicate line should be removed
      console.log(`[Ollama] Detected remove operation for line ${finding.lineNumber}`);
      return '__REMOVE_LINE__';
    }
    
    // If suggestion already contains code (looks like code), use it directly
    if (finding.suggestion) {
      const suggestionText = finding.suggestion.trim();
      
      // Check if suggestion looks like code (contains operators, semicolons, brackets, etc.)
      const codeIndicators = /[=+\-*\/%;<>(){}\[\]]/.test(suggestionText);
      const hasCodeStructure = suggestionText.includes('=') || 
                                suggestionText.includes('(') ||
                                suggestionText.includes(';') ||
                                suggestionText.includes('{') ||
                                suggestionText.includes('return') ||
                                suggestionText.includes('if') ||
                                suggestionText.includes('const') ||
                                suggestionText.includes('let') ||
                                suggestionText.includes('int') ||
                                suggestionText.includes('void') ||
                                suggestionText.includes('#include') ||
                                suggestionText.includes('printf') ||
                                suggestionText.includes('scanf');
      
      if (codeIndicators || hasCodeStructure) {
        // Extract just the code part (remove any "Fix:" prefix or explanation)
        let codeFix = suggestionText;
        
        // Remove "Fix:" prefix if present
        codeFix = codeFix.replace(/^fix[:\-]\s*/i, '').trim();
        
        // Remove common explanation prefixes (but keep code after them)
        codeFix = codeFix.replace(/^(change|replace|use|try)\s+/i, '').trim();
        
        // Remove quotes around code
        if ((codeFix.startsWith('"') && codeFix.endsWith('"')) ||
            (codeFix.startsWith("'") && codeFix.endsWith("'"))) {
          codeFix = codeFix.slice(1, -1).trim();
        }
        
        // If it contains code blocks, extract code
        if (codeFix.includes('`')) {
          const codeBlockMatch = codeFix.match(/`([^`]+)`/);
          if (codeBlockMatch) {
            codeFix = codeBlockMatch[1];
          }
        }
        
        // Remove any trailing explanation text (after semicolon or closing brace)
        const codeEndMatch = codeFix.match(/^([^;]+(?:;|}))[^;]*$/);
        if (codeEndMatch) {
          codeFix = codeEndMatch[1].trim();
        }
        
        // Take first line if multiple lines (usually the fix is one line)
        codeFix = codeFix.split('\n')[0].trim();
        
        // Remove any remaining explanation text
        if (codeFix.includes('.')) {
          const parts = codeFix.split('.');
          if (parts.length > 1 && parts[0].match(/[=+\-*\/%;<>(){}\[\]]/)) {
            codeFix = parts[0].trim();
          }
        }
        
        console.log(`[Ollama] Using suggestion directly as code fix: ${codeFix}`);
        return codeFix;
      }
    }
    
    // Fallback to LLM only for complex fixes
    console.log(`[Ollama] Using LLM for complex fix...`);
    const contextLines = 2;
    let contextStart = Math.max(0, targetLineIndex - contextLines);
    let contextEnd = Math.min(lines.length, targetLineIndex + contextLines + 1);
    const contextCode = lines.slice(contextStart, contextEnd).join('\n');
    
    const prompt = `Fix line ${finding.lineNumber} based on this suggestion:

Issue: ${finding.message}
Suggestion: ${finding.suggestion || 'Fix the issue'}

Context:
${contextCode.split('\n').map((line, idx) => `${contextStart + idx + 1}: ${line}`).join('\n')}

Instructions:
- If the suggestion says to REMOVE or DELETE this line, respond with "__REMOVE_LINE__"
- Otherwise, provide ONLY the fixed line ${finding.lineNumber} (just the code, no explanations)
- Do NOT include the line number or explanations

Fixed line:`;

    console.log(`[Ollama] Generating code fix for line ${finding.lineNumber}...`);
    console.log(`[Ollama] Original line: ${originalLine}`);
    console.log(`[Ollama] Suggestion: ${finding.suggestion}`);
    
    const response = await axios.post(`${OLLAMA_API_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.1,
        top_p: 0.9,
        num_predict: 50 // Very short response
      }
    }, {
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    let fixedCode = response.data.response || '';
    fixedCode = fixedCode.trim();
    fixedCode = fixedCode.replace(/```[\w]*\n?/g, '').trim();
    fixedCode = fixedCode.replace(/^\d+:\s*/, '');
    
    // Check if Ollama said to remove the line
    if (fixedCode.toLowerCase().includes('__remove_line__') || 
        fixedCode.toLowerCase().includes('remove') && fixedCode.toLowerCase().includes('line')) {
      return '__REMOVE_LINE__';
    }
    
    const fixedLines = fixedCode.split('\n').filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      const lower = trimmed.toLowerCase();
      if (lower.startsWith('here') || 
          lower.startsWith('the fixed') ||
          lower.startsWith('fixed code') ||
          lower.startsWith('the corrected') ||
          (lower.startsWith('change') || lower.startsWith('replace') || lower.startsWith('use')) && 
          !lower.includes('=') && !lower.includes(';')) {
        return false;
      }
      return true;
    });
    
    const result = fixedLines[0] || originalLine;
    console.log(`[Ollama] Generated fix: ${result}`);
    return result;
  } catch (error) {
    console.error('[Ollama] Error generating code fix:', error.message);
    throw new Error(`Failed to generate code fix: ${error.message}`);
  }
};

/**
 * Test Ollama connection
 */
export const testOllamaConnection = async () => {
  try {
    const response = await axios.get(`${OLLAMA_API_URL}/api/tags`);
    return {
      connected: true,
      models: response.data.models || []
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message
    };
  }
};
