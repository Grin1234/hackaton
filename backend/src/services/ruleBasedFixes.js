/**
 * Rule-based code fixes for common issues
 * This provides deterministic, fast fixes without needing LLM
 */

/**
 * Apply rule-based fixes based on finding message and suggestion
 * @param {string} codeContent - The code content
 * @param {string} language - Programming language
 * @param {Object} finding - The finding object
 * @returns {string|null} - The fixed code or null if rule-based fix doesn't apply
 */
export function applyRuleBasedFix(codeContent, language, finding) {
  const lines = codeContent.split('\n');
  const lineIndex = (finding.lineNumber || 1) - 1;
  
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return null;
  }
  
  const originalLine = lines[lineIndex];
  const trimmedLine = originalLine.trim();
  const suggestion = finding.suggestion?.toLowerCase() || '';
  const message = finding.message?.toLowerCase() || '';
  
  // Rule 1: Remove duplicate declarations
  if (message.includes('duplicate') && (suggestion.includes('remove') || suggestion.includes('delete'))) {
    return '__REMOVE_LINE__';
  }
  
  // Rule 2: Missing semicolon
  if (message.includes('missing semicolon') || message.includes('semicolon')) {
    if (trimmedLine && !trimmedLine.endsWith(';') && !trimmedLine.endsWith('{') && !trimmedLine.endsWith('}')) {
      const indent = originalLine.match(/^(\s*)/)?.[1] || '';
      return indent + trimmedLine + ';';
    }
  }
  
  // Rule 3: Add const/let for JavaScript
  if (language === 'javascript' || language === 'typescript') {
    if (message.includes('use const') && suggestion.includes('const')) {
      const indent = originalLine.match(/^(\s*)/)?.[1] || '';
      const fixedLine = trimmedLine.replace(/^(let|var)\s+/, 'const ');
      return indent + fixedLine;
    }
    if (message.includes('use let') && suggestion.includes('let')) {
      const indent = originalLine.match(/^(\s*)/)?.[1] || '';
      const fixedLine = trimmedLine.replace(/^var\s+/, 'let ');
      return indent + fixedLine;
    }
  }
  
  // Rule 4: Fix indentation (common issues)
  if (message.includes('indentation') || message.includes('indent')) {
    // Get expected indentation from context
    const contextStart = Math.max(0, lineIndex - 1);
    const prevLine = lines[contextStart];
    const prevIndent = prevLine.match(/^(\s*)/)?.[1] || '';
    
    // If line has no indentation but should, add it
    if (!originalLine.match(/^\s/) && prevIndent) {
      return prevIndent + trimmedLine;
    }
    
    // If line has wrong indentation, fix it
    if (prevLine.trim().endsWith('{')) {
      const indent = prevIndent + '  '; // 2 spaces
      return indent + trimmedLine;
    }
  }
  
  // Rule 5: Remove unused variable
  if ((message.includes('unused') || message.includes('not used')) && 
      (suggestion.includes('remove') || suggestion.includes('delete'))) {
    return '__REMOVE_LINE__';
  }
  
  // Rule 6: Fix spacing around operators
  if (message.includes('spacing') || message.includes('space')) {
    // Fix: a=1 -> a = 1
    const fixedLine = trimmedLine
      .replace(/([a-zA-Z0-9_])=([a-zA-Z0-9_])/g, '$1 = $2')
      .replace(/([a-zA-Z0-9_])\+([a-zA-Z0-9_])/g, '$1 + $2')
      .replace(/([a-zA-Z0-9_])\-([a-zA-Z0-9_])/g, '$1 - $2')
      .replace(/([a-zA-Z0-9_])\*([a-zA-Z0-9_])/g, '$1 * $2')
      .replace(/([a-zA-Z0-9_])\/([a-zA-Z0-9_])/g, '$1 / $2');
    
    if (fixedLine !== trimmedLine) {
      const indent = originalLine.match(/^(\s*)/)?.[1] || '';
      return indent + fixedLine;
    }
  }
  
  // Rule 7: Remove trailing whitespace
  if (message.includes('trailing whitespace') || message.includes('trailing space')) {
    const indent = originalLine.match(/^(\s*)/)?.[1] || '';
    return indent + trimmedLine;
  }
  
  // Rule 8: Fix comparison operators (== to ===)
  if (language === 'javascript' || language === 'typescript') {
    if (message.includes('use ===') || message.includes('strict equality')) {
      const indent = originalLine.match(/^(\s*)/)?.[1] || '';
      const fixedLine = trimmedLine.replace(/==/g, '===').replace(/!=/g, '!==');
      return indent + fixedLine;
    }
  }
  
  // Rule 9: Remove empty line
  if (message.includes('empty line') && suggestion.includes('remove')) {
    return '__REMOVE_LINE__';
  }
  
  // Rule 10: Extract code from suggestion if it looks like code
  if (finding.suggestion) {
    const codeMatch = finding.suggestion.match(/([a-zA-Z_][a-zA-Z0-9_]*\s*=\s*[^;]+;|[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*\{?)/);
    if (codeMatch && !suggestion.includes('example') && !suggestion.includes('like')) {
      const indent = originalLine.match(/^(\s*)/)?.[1] || '';
      return indent + codeMatch[1].trim();
    }
  }
  
  return null; // No rule-based fix available
}

/**
 * Check if a fix should use rule-based approach
 * @param {Object} finding - The finding object
 * @returns {boolean}
 */
export function shouldUseRuleBasedFix(finding) {
  const message = finding.message?.toLowerCase() || '';
  const suggestion = finding.suggestion?.toLowerCase() || '';
  
  // Use rule-based for these common patterns
  const ruleBasedPatterns = [
    'duplicate',
    'missing semicolon',
    'use const',
    'use let',
    'indentation',
    'unused',
    'spacing',
    'trailing whitespace',
    'strict equality',
    'empty line',
    'remove',
    'delete'
  ];
  
  return ruleBasedPatterns.some(pattern => 
    message.includes(pattern) || suggestion.includes(pattern)
  );
}

