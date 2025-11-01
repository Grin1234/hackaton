import { useState, useEffect, useCallback } from 'react'
import CodeViewer from './CodeViewer'
import ReviewHistoryPanel from './ReviewHistoryPanel'
import WorkspaceManager from './WorkspaceManager'
import LLMChat from './LLMChat'
import { electronAPI } from '../services/ipc'

// Browser-compatible path utilities
const basename = (path) => {
  return path.split(/[/\\]/).pop() || path
}

export default function ReviewPanel({ filePath, review: initialReview }) {
  const [review, setReview] = useState(initialReview)
  const [loading, setLoading] = useState(!initialReview)
  const [highlightedLine, setHighlightedLine] = useState(null)
  const [codeContent, setCodeContent] = useState(initialReview?.codeContent || '')
  const [error, setError] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedHistoryReview, setSelectedHistoryReview] = useState(null)
  const [workspacePath, setWorkspacePath] = useState(null)
  const [gitHookInstalled, setGitHookInstalled] = useState(false)
  const [showWorkspaceManager, setShowWorkspaceManager] = useState(false)
  const [filterCategory, setFilterCategory] = useState(null) // null = all, 'security', 'performance', 'documentation'
  const [reviewMode, setReviewMode] = useState('auto') // 'auto', 'incremental', 'full'
  const [isReviewing, setIsReviewing] = useState(false)
  const [showChat, setShowChat] = useState(false) // Toggle chat visibility

  const loadReview = useCallback(async () => {
    if (window.electronAPI) {
      setLoading(true)
      setError(null)
      try {
        console.log('Loading review for:', filePath)
        const rev = await window.electronAPI.file.getReview(filePath)
        console.log('Review loaded:', rev)
        if (rev) {
          setReview(rev)
          setCodeContent(rev.codeContent || '')
        } else {
          setError('No review found for this file. The file may not have been reviewed yet.')
        }
      } catch (err) {
        console.error('Failed to load review:', err)
        setError('Failed to load review: ' + (err.message || err))
      } finally {
        setLoading(false)
      }
    } else {
      setError('Electron API not available')
      setLoading(false)
    }
  }, [filePath])

  useEffect(() => {
    console.log('ReviewPanel useEffect:', { filePath, initialReview, hasReview: !!review })
    if (initialReview) {
      setReview(initialReview)
      setCodeContent(initialReview.codeContent || '')
      setLoading(false)
    } else if (!review && filePath && window.electronAPI) {
      console.log('No initial review, loading...')
      loadReview()
    }
    
    // Detect workspace path
    if (window.electronAPI && window.electronAPI.workspace) {
      window.electronAPI.workspace.list().then(workspaces => {
        const workspace = workspaces.find(ws => filePath.startsWith(ws.path))
        if (workspace) {
          setWorkspacePath(workspace.path)
        }
      })
    }
  }, [filePath, initialReview, review, loadReview])
  
  const handleInstallGitHook = async () => {
    if (!workspacePath) {
      alert('Workspace path not found. Please ensure the file is in a workspace.')
      return
    }
    
    if (!window.electronAPI || !window.electronAPI.git) {
      alert('Git API not available')
      return
    }
    
    try {
      const result = await window.electronAPI.git.installHook(workspacePath)
      if (result && result.success) {
        setGitHookInstalled(true)
        alert('Pre-commit hook installed successfully!')
      } else {
        const errorMsg = result?.error || 'Unknown error'
        alert(`Failed to install hook: ${errorMsg}`)
      }
    } catch (err) {
      console.error('Error installing git hook:', err)
      alert(`Error installing hook: ${err.message || err}`)
    }
  }
  
  const handleSelectHistoryReview = (historyReview) => {
    setSelectedHistoryReview(historyReview)
    setReview(historyReview)
    setCodeContent(historyReview.codeContent || '')
  }

  const handleTriggerReview = async () => {
    if (!filePath || !workspacePath) {
      alert('File path or workspace path not available')
      return
    }
    
    if (!window.electronAPI || !window.electronAPI.review) {
      alert('Review API not available')
      return
    }
    
    setIsReviewing(true)
    try {
      const mode = reviewMode === 'auto' ? null : reviewMode
      await window.electronAPI.review.triggerReview(filePath, workspacePath, mode)
      // Reload review after a short delay
      setTimeout(() => {
        loadReview()
      }, 2000)
    } catch (err) {
      console.error('Error triggering review:', err)
      alert(`Failed to trigger review: ${err.message || err}`)
    } finally {
      setIsReviewing(false)
    }
  }
  
  const handleCodeChange = async (newCode) => {
    setCodeContent(newCode)
    // Save to file if API available
    if (window.electronAPI && window.electronAPI.file?.saveFile) {
      try {
        await window.electronAPI.file.saveFile(filePath, newCode)
      } catch (err) {
        console.error('Failed to save file:', err)
      }
    }
  }


  // Get icon for category (Cursor-style symbols)
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'security': return '◉'
      case 'performance': return '▲'
      case 'documentation': return '📝'
      case 'quality': return '•'
      case 'best-practices': return '✓'
      case 'bug': return '!'
      case 'architecture': return '▸'
      default: return '•'
    }
  }

  // Filter findings to show security/performance/documentation related ones
  // Also filter out syntax errors and invalid findings
  const securityAndPerformanceFindings = review?.findings?.filter(f => {
    // Must be security, performance, or documentation category
    if (f.category !== 'security' && f.category !== 'performance' && f.category !== 'documentation') return false;
    
    // Apply category filter if set
    if (filterCategory && f.category !== filterCategory) return false;
    
    // Skip if message or suggestion mentions syntax errors
    const messageLower = (f.message || '').toLowerCase();
    const suggestionLower = (f.suggestion || '').toLowerCase();
    if (messageLower.includes('syntax error') || messageLower.includes('fix the syntax') ||
        suggestionLower.includes('syntax error') || suggestionLower.includes('fix the syntax') ||
        messageLower.includes('compiler error') || messageLower.includes('missing semicolon') ||
        messageLower.includes('missing bracket') || messageLower.includes('missing brace')) {
      return false;
    }
    
    return true;
  }) || []

  // Debug: log findings
  useEffect(() => {
    console.log('=== ReviewPanel Debug ===')
    console.log('Review exists:', !!review)
    console.log('Review status:', review?.status)
    console.log('Total findings:', review?.findings?.length || 0)
    console.log('All findings:', review?.findings)
    console.log('Security/Performance findings after filter:', securityAndPerformanceFindings.length)
    console.log('Security/Performance findings details:', securityAndPerformanceFindings)
    console.log('Review text:', review?.review?.substring(0, 500))
    console.log('========================')
  }, [review, securityAndPerformanceFindings])

  // Format review text to be more intuitive and readable
  // Filters out syntax errors and "N/A" line numbers
  const formatReviewText = (reviewText) => {
    if (!reviewText) return ''
    
    // Escape HTML to prevent XSS
    const escapeHtml = (text) => {
      const div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    }
    
    // First, remove sections with "N/A" line numbers or syntax errors
    const lines = reviewText.split('\n')
    const filteredLines = []
    let skipSection = false
    let currentSectionHeader = null
    
    lines.forEach((line, index) => {
      const trimmed = line.trim()
      const lowerTrimmed = trimmed.toLowerCase()
      
      // Detect section headers
      if (trimmed.match(/^(Security|Performance)\s+(Vulnerabilities|Issues)[:\-]/i)) {
        currentSectionHeader = trimmed
        // Don't add header yet, wait to see if section has valid content
        return
      }
      
      // Check if this line starts a section with N/A or syntax error
      if (trimmed.match(/^Line\s+(number[:\-]\s*)?N\/A/i) || 
          lowerTrimmed.includes('as this is a syntax error') ||
          lowerTrimmed.includes('line number: n/a')) {
        skipSection = true
        currentSectionHeader = null // Don't keep header if section is invalid
        return
      }
      
      // Check if this line contains syntax error mentions
      if (lowerTrimmed.includes('syntax error') && 
          (lowerTrimmed.includes('fix the syntax') || lowerTrimmed.includes('suggestion:'))) {
        skipSection = true
        currentSectionHeader = null
        return
      }
      
      // Stop skipping when we hit a new valid section
      if (skipSection) {
        if (trimmed.match(/^Line\s+\d+/i)) {
          // Valid line number found, stop skipping
          skipSection = false
          currentSectionHeader = null
        } else if (!trimmed) {
          // Empty line, might be section break
          skipSection = false
          currentSectionHeader = null
        } else {
          // Still skipping
          return
        }
      }
      
      // Skip lines that mention syntax errors in suggestions
      if (lowerTrimmed.includes('suggestion') && 
          (lowerTrimmed.includes('fix the syntax error') || lowerTrimmed.includes('syntax error'))) {
        return
      }
      
      // Only add section header if we're not skipping and we have valid content
      if (currentSectionHeader && trimmed.match(/^Line\s+\d+/i)) {
        filteredLines.push(currentSectionHeader)
        currentSectionHeader = null
      }
      
      filteredLines.push(line)
    })
    
    // Now format the filtered lines
    const formatted = []
    let inFinding = false
    
    filteredLines.forEach((line) => {
      const trimmed = line.trim()
      
      if (!trimmed) {
        if (inFinding) {
          formatted.push('</div>')
          inFinding = false
        }
        return
      }
      
      // Detect numbered findings (1. **Title**)
      if (trimmed.match(/^\d+\.\s*\*\*/)) {
        const titleMatch = trimmed.match(/^\d+\.\s*\*\*([^*]+)\*\*/)
        if (titleMatch) {
          if (inFinding) formatted.push('</div>')
          inFinding = true
          formatted.push(`<div class="mb-2 p-2 bg-cursor-bg-secondary rounded-lg border-l-4 border-cursor-accent shadow-lg break-words overflow-wrap-anywhere">`)
          formatted.push(`<h4 class="text-xs font-bold text-cursor-accent mb-1 break-words">${escapeHtml(titleMatch[1])}</h4>`)
        }
      }
      // Detect line numbers (findings) - both "Line X:" and "Line Number: X" formats
      else if (trimmed.match(/^Line\s+(Number\s*:?\s*)?\d+/i)) {
        const lineNumMatch = trimmed.match(/Line\s+(?:Number\s*:?\s*)?(\d+)/i)
        const lineNum = lineNumMatch?.[1] || ''
        // Only process if it's a valid number
        if (lineNum && !isNaN(parseInt(lineNum)) && parseInt(lineNum) > 0) {
          if (!inFinding) {
            inFinding = true
            formatted.push(`<div class="mb-2 p-2 bg-cursor-bg-secondary rounded-lg border-l-4 border-cursor-accent shadow-sm break-words overflow-wrap-anywhere">`)
          }
          formatted.push(`<div class="flex items-center gap-2 mb-1 break-words"><span class="font-mono text-xs font-semibold text-cursor-accent break-words">Line ${escapeHtml(lineNum)}</span>`)
        }
      }
      // Detect severity markers - both "[severity]" and "Severity: severity" formats
      else if (trimmed.match(/Severity[:\-]\s*(critical|high|medium|low)/i) && inFinding) {
        const severityMatch = trimmed.match(/Severity[:\-]\s*(critical|high|medium|low)/i)
        const severity = severityMatch?.[1]?.toLowerCase() || 'medium'
        const severityColors = {
          critical: 'text-critical bg-critical-bg border-critical border-2',
          high: 'text-high bg-high-bg border-high border-2',
          medium: 'text-medium bg-medium-bg border-medium border-2',
          low: 'text-low bg-low-bg border-low border-2'
        }
        formatted.push(`<span class="px-2 py-1 rounded-lg text-xs font-bold shadow-sm ${severityColors[severity] || 'text-cursor-text-muted bg-cursor-bg-tertiary'}">${severity.toUpperCase()}</span>`)
        if (!trimmed.includes('Category')) {
          formatted.push('</div>')
        }
      }
      else if (trimmed.match(/\[(critical|high|medium|low)\]/i) && inFinding) {
        const severity = trimmed.match(/\[(critical|high|medium|low)\]/i)?.[1] || 'medium'
        const severityColors = {
          critical: 'text-critical bg-critical-bg border-critical border-2',
          high: 'text-high bg-high-bg border-high border-2',
          medium: 'text-medium bg-medium-bg border-medium border-2',
          low: 'text-low bg-low-bg border-low border-2'
        }
        formatted.push(`<span class="px-2 py-1 rounded-lg text-xs font-bold shadow-sm ${severityColors[severity] || 'text-cursor-text-muted bg-cursor-bg-tertiary'}">${severity.toUpperCase()}</span></div>`)
      }
      // Check if it's an impact
      else if (trimmed.match(/^Impact[:\-]/i) && inFinding) {
        const impactText = trimmed.replace(/^Impact[:\-]\s*/i, '')
        formatted.push(`<div class="mt-2 p-2 bg-critical-bg rounded-lg border-2 border-critical border-opacity-30 shadow-sm"><p class="text-xs font-bold text-critical mb-1 uppercase tracking-wide">Impact</p><p class="text-xs text-cursor-text-primary leading-relaxed break-words whitespace-normal">${escapeHtml(impactText)}</p></div>`)
      }
      // Check if it's a suggestion
      else if (trimmed.match(/^Suggestion[:\-]/i) && inFinding) {
        const suggestionText = trimmed.replace(/^Suggestion[:\-]\s*/i, '')
        // Skip if suggestion mentions syntax errors
        if (!suggestionText.toLowerCase().includes('syntax error') && 
            !suggestionText.toLowerCase().includes('fix the syntax')) {
          formatted.push(`<div class="mt-2 p-2 bg-low-bg/30 rounded-lg border-2 border-low border-opacity-30 shadow-sm"><p class="text-xs font-bold text-low mb-1 uppercase tracking-wide">Suggestion</p><p class="text-xs text-cursor-text-primary leading-relaxed break-words whitespace-normal">${escapeHtml(suggestionText)}</p></div>`)
        }
      }
      // Detect category
      else if (trimmed.match(/^Category[:\-]/i) && inFinding) {
        const categoryText = trimmed.replace(/^Category[:\-]\s*/i, '')
        formatted.push(`<span class="px-2 py-1 rounded text-xs font-medium bg-cursor-bg-tertiary text-cursor-text-primary capitalize ml-2">${escapeHtml(categoryText)}</span></div>`)
      }
      // Regular content - show headers and content
      else if (trimmed.length > 0 && 
               !trimmed.toLowerCase().includes('syntax error') &&
               !trimmed.toLowerCase().includes('n/a')) {
        // Check if it's a section header
        if (trimmed.match(/^(Security|Performance)\s+(Vulnerabilities|Issues|Analysis)/i)) {
          formatted.push(`<h3 class="text-xs font-semibold mb-2 mt-3 text-cursor-text-secondary uppercase tracking-wide">${escapeHtml(trimmed)}</h3>`)
        } else if (inFinding) {
          formatted.push(`<p class="text-xs text-cursor-text-primary leading-relaxed mb-2 break-words whitespace-normal">${escapeHtml(trimmed)}</p>`)
        } else {
          // Show content even if not in a finding (for section headers, etc.)
          formatted.push(`<p class="text-xs text-cursor-text-primary leading-relaxed mb-2 break-words whitespace-normal">${escapeHtml(trimmed)}</p>`)
        }
      }
    })
    
    if (inFinding) formatted.push('</div>')
    
    return formatted.join('')
  }

  // Count findings by category - use ALL findings for category buttons
  const findingsByCategory = (review?.findings || []).reduce((acc, finding) => {
    const cat = finding.category || 'other'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})

  // Generate user-friendly summary
  const generateSummary = () => {
    if (!review || !securityAndPerformanceFindings || securityAndPerformanceFindings.length === 0) {
      // Check if review text exists but was filtered out
      const hasFilteredContent = review?.review && 
        (review.review.toLowerCase().includes('security') || review.review.toLowerCase().includes('performance')) &&
        securityAndPerformanceFindings.length === 0;
      
      return {
        title: 'No Security or Performance Issues',
        message: hasFilteredContent 
          ? 'Syntax errors and style issues were filtered out. No security vulnerabilities or performance issues identified.'
          : 'No security vulnerabilities or performance issues identified.',
        icon: '✓'
      }
    }

    const critical = securityAndPerformanceFindings.filter(f => f.severity === 'critical').length
    const high = securityAndPerformanceFindings.filter(f => f.severity === 'high').length
    const medium = securityAndPerformanceFindings.filter(f => f.severity === 'medium').length
    const low = securityAndPerformanceFindings.filter(f => f.severity === 'low').length

    const categories = {}
    securityAndPerformanceFindings.forEach(f => {
      const cat = f.category || 'quality'
      categories[cat] = (categories[cat] || 0) + 1
    })

    let title = 'Security & Performance Review'
    let message = `Found ${securityAndPerformanceFindings.length} security or performance issue${securityAndPerformanceFindings.length !== 1 ? 's' : ''}`
    let icon = '●'

    if (critical > 0) {
      title = 'Critical Security/Performance Issues'
      message = `${critical} critical issue${critical !== 1 ? 's' : ''} need${critical === 1 ? 's' : ''} immediate attention`
      icon = '⚠'
    } else if (high > 0) {
      title = 'Important Security/Performance Issues'
      message = `${high} high-priority issue${high !== 1 ? 's' : ''} found`
      icon = '▲'
    } else if (medium > 0) {
      title = 'Security/Performance Improvements'
      message = `${medium} improvement${medium !== 1 ? 's' : ''} recommended`
      icon = '•'
    } else {
      title = 'Minor Security/Performance Suggestions'
      message = `${low} minor suggestion${low !== 1 ? 's' : ''} for optimization`
      icon = '○'
    }

    return { title, message, icon, critical, high, medium, low, categories }
  }

  const summary = generateSummary()
  
  console.log('Summary generated:', summary)
  console.log('Will show summary section:', true)

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-cursor-bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-cursor-accent border-t-transparent mx-auto mb-3"></div>
          <p className="text-cursor-text-primary text-sm font-normal mb-1">Analyzing code...</p>
          <p className="text-xs text-cursor-text-muted">{basename(filePath)}</p>
          <p className="text-xs text-cursor-text-muted mt-1">This may take 1-3 minutes</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-cursor-bg-primary">
        <div className="text-center p-6 bg-cursor-bg-secondary border border-cursor-border max-w-md">
          <div className="text-lg mb-2 text-cursor-error">⚠</div>
          <h2 className="text-sm font-normal text-cursor-error mb-2">Error</h2>
          <p className="text-xs text-cursor-text-primary mb-4">{error}</p>
          <button
            onClick={loadReview}
            className="px-3 py-1.5 bg-cursor-accent text-white rounded text-xs font-normal transition-colors hover:bg-cursor-accent-hover"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!review) {
    return (
      <div className="flex-1 flex items-center justify-center bg-cursor-bg-primary">
        <div className="text-center p-6 bg-cursor-bg-secondary border border-cursor-border max-w-md">
          <h2 className="text-sm font-normal text-cursor-text-primary mb-2">No Review Available</h2>
          <p className="text-xs text-cursor-text-secondary mb-3">
            This file hasn't been reviewed yet. Save the file to trigger an automatic review.
          </p>
          <p className="text-xs text-cursor-text-muted font-mono truncate">{filePath}</p>
        </div>
      </div>
    )
  }

  // Show processing state if review is still being generated
  if (review.status === 'processing') {
    return (
      <div className="flex-1 flex items-center justify-center bg-cursor-bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-cursor-accent border-t-transparent mx-auto mb-3"></div>
          <p className="text-cursor-text-primary text-sm font-normal mb-1">Analyzing code for security and performance issues...</p>
          <p className="text-xs text-cursor-text-muted">{basename(filePath)}</p>
          <p className="text-xs text-cursor-text-muted mt-1">This may take 1-3 minutes</p>
        </div>
      </div>
    )
  }

  // Show error state if review failed
  if (review.status === 'failed') {
    return (
      <div className="flex-1 flex items-center justify-center bg-cursor-bg-primary">
        <div className="text-center p-6 bg-cursor-bg-secondary border border-cursor-border max-w-md">
          <div className="text-lg mb-2 text-cursor-error">✗</div>
          <h2 className="text-sm font-normal text-cursor-error mb-2">Review Failed</h2>
          <p className="text-xs text-cursor-text-primary mb-4">
            {review.error || 'Failed to generate code review. Please check your Ollama service and try again.'}
          </p>
          <button
            onClick={loadReview}
            className="px-3 py-1.5 bg-cursor-accent text-white rounded text-xs font-normal transition-colors hover:bg-cursor-accent-hover"
          >
            Retry Review
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-cursor-bg-primary">
      {/* VS Code-style Header */}
      <div className="bg-cursor-bg-secondary border-b border-cursor-border">
        <div className="px-3 py-2">
          <div className="flex justify-between items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-sm font-normal text-cursor-text-primary truncate">{basename(filePath)}</h2>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-normal vscode-badge ${
                  review.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
                  review.status === 'failed' ? 'bg-red-500/20 text-red-400' : 
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {review.status}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-cursor-text-secondary">
                <span className="text-cursor-text-muted">Language:</span>
                <span className="text-cursor-text-primary">{review.language}</span>
                {review.reviewVersion && (
                  <>
                    <span className="text-cursor-text-muted">•</span>
                    <span className="text-cursor-text-muted">Version:</span>
                    <span className="text-cursor-text-primary">{review.reviewVersion}</span>
                {review.incremental && (
                  <span className="px-1 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                    Incremental Review
                  </span>
                )}
                  </>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-cursor-text-secondary">
                {review.updatedAt ? new Date(review.updatedAt).toLocaleString() : 'Just now'}
              </p>
              {securityAndPerformanceFindings && securityAndPerformanceFindings.length > 0 && (
                <p className="text-xs text-cursor-text-muted mt-0.5">
                  {securityAndPerformanceFindings.length} issue{securityAndPerformanceFindings.length !== 1 ? 's' : ''}
                </p>
              )}
              {review.tokenUsage && review.tokenUsage.totalTokens && (
                <p className="text-xs text-cursor-text-muted mt-0.5">
                  {review.tokenUsage.totalTokens.toLocaleString()} tokens
                </p>
              )}
            </div>
          </div>
        </div>
        {/* Action Buttons */}
        <div className="px-3 py-1 border-t border-cursor-border flex gap-1.5 flex-wrap justify-between items-center">
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-2 py-1 bg-cursor-bg-tertiary hover:bg-cursor-hover text-cursor-text-primary rounded text-xs font-normal transition-colors"
            >
              {showHistory ? '▼ Hide' : '▶ Show'} History
            </button>
            <button
              onClick={handleTriggerReview}
              disabled={isReviewing || !filePath || !workspacePath}
              className="px-2 py-1 bg-cursor-accent hover:bg-cursor-accent-hover disabled:bg-cursor-bg-tertiary disabled:text-cursor-text-muted text-white rounded text-xs font-normal transition-colors"
              title="Trigger new review"
            >
              {isReviewing ? 'Reviewing...' : '🔄 Review Now'}
            </button>
            <button
              onClick={() => setShowChat(!showChat)}
              className={`px-2 py-1 rounded text-xs font-normal transition-colors ${
                showChat
                  ? 'bg-cursor-accent text-white'
                  : 'bg-cursor-bg-tertiary hover:bg-cursor-hover text-cursor-text-primary'
              }`}
              title="Toggle AI Chat"
            >
              {showChat ? '▼ Hide Chat' : '💬 Chat'}
            </button>
            {workspacePath && (
              <button
                onClick={handleInstallGitHook}
                disabled={gitHookInstalled}
                className="px-2 py-1 bg-cursor-accent hover:bg-cursor-accent-hover disabled:bg-cursor-bg-tertiary disabled:text-cursor-text-muted text-white rounded text-xs font-normal transition-colors"
              >
                {gitHookInstalled ? '✓ Hook Installed' : 'Install Git Hook'}
              </button>
            )}
          </div>
          <button
            onClick={() => setShowWorkspaceManager(true)}
            className="px-2 py-1 bg-cursor-bg-tertiary hover:bg-cursor-hover text-cursor-text-primary rounded text-xs font-normal transition-colors"
            title="Import custom guidelines"
          >
            📋 Import Guidelines
          </button>
        </div>
        {/* Review Mode Selector */}
        <div className="px-3 py-1 border-t border-cursor-border flex items-center gap-1">
          <span className="text-xs text-cursor-text-secondary">Review Mode:</span>
          <select
            value={reviewMode}
            onChange={(e) => setReviewMode(e.target.value)}
            className="text-xs bg-cursor-bg-primary text-cursor-text-primary border border-cursor-border rounded px-1.5 py-0.5 focus:outline-none focus:border-cursor-accent"
            title="Select review mode"
          >
            <option value="auto">Auto</option>
            <option value="incremental">Incremental</option>
            <option value="full">Full</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {/* Review History Panel - Show at top when enabled */}
        {showHistory && (
          <div className="bg-cursor-bg-secondary p-3 mb-3 border border-cursor-border">
            <h3 className="text-xs font-normal mb-2 text-cursor-text-primary uppercase tracking-wider">
              Review History
            </h3>
            <ReviewHistoryPanel
              filePath={filePath}
              onSelectReview={handleSelectHistoryReview}
            />
          </div>
        )}

        {/* VS Code-style Summary */}
        {review.incremental && (
          <div className="p-2 mb-3 border border-blue-500/30 bg-blue-500/10">
            <div className="flex items-center gap-2">
              <span className="text-blue-400 text-xs">ℹ</span>
              <span className="text-xs text-blue-400">
                Incremental Review: Only reviewing changed code segments (extracted from git diff)
              </span>
            </div>
          </div>
        )}
        <div className={`p-3 mb-3 border ${
          summary.critical > 0 ? 'bg-red-500/10 border-red-500/30' :
          summary.high > 0 ? 'bg-orange-500/10 border-orange-500/30' :
          summary.medium > 0 ? 'bg-yellow-500/10 border-yellow-500/30' :
          summary.low > 0 ? 'bg-blue-500/10 border-blue-500/30' :
          'bg-green-500/10 border-green-500/30'
        }`}>
          <div className="flex items-start gap-2">
            <span className={`text-xs font-normal flex-shrink-0 ${
              summary.critical > 0 ? 'text-red-400' :
              summary.high > 0 ? 'text-orange-400' :
              summary.medium > 0 ? 'text-yellow-400' :
              summary.low > 0 ? 'text-blue-400' :
              'text-green-400'
            }`}>{summary.icon}</span>
            <div className="flex-1">
              <h3 className={`text-xs font-normal mb-1 ${
                summary.critical > 0 ? 'text-red-400' :
                summary.high > 0 ? 'text-orange-400' :
                summary.medium > 0 ? 'text-yellow-400' :
                summary.low > 0 ? 'text-blue-400' :
                'text-green-400'
              }`}>{summary.title}</h3>
              <p className="text-xs text-cursor-text-secondary mb-2">{summary.message}</p>
              {securityAndPerformanceFindings && securityAndPerformanceFindings.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {summary.critical > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs font-normal vscode-badge">
                      {summary.critical} Critical
                    </span>
                  )}
                  {summary.high > 0 && (
                    <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-xs font-normal vscode-badge">
                      {summary.high} High
                    </span>
                  )}
                  {summary.medium > 0 && (
                    <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-normal vscode-badge">
                      {summary.medium} Medium
                    </span>
                  )}
                  {summary.low > 0 && (
                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-normal vscode-badge">
                      {summary.low} Low
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Review Summary Section */}
        {review.review && review.review.trim().length > 0 && (
          <div className="bg-cursor-bg-secondary p-3 mb-3 border border-cursor-border">
            <h3 className="text-xs font-normal mb-2 text-cursor-text-primary uppercase tracking-wider">
              Security & Performance Analysis
            </h3>
            <div className="bg-cursor-bg-primary p-2 border border-cursor-border">
              <p className="text-xs text-cursor-text-primary break-words">
                {review.review.trim()}
              </p>
            </div>
          </div>
        )}

        {/* Category Summary */}
        {Object.keys(findingsByCategory).length > 0 && (
          <div className="bg-cursor-bg-secondary p-3 mb-3 border border-cursor-border relative z-10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-normal text-cursor-text-primary uppercase tracking-wider">
                Insights by Category
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setFilterCategory(null)}
                  className={`px-1.5 py-0.5 text-xs font-normal rounded transition-colors ${
                    filterCategory === null
                      ? 'bg-cursor-accent text-white'
                      : 'bg-cursor-bg-tertiary text-cursor-text-secondary hover:bg-cursor-hover'
                  }`}
                  title="Show all categories"
                >
                  All
                </button>
                {findingsByCategory.security > 0 && (
                  <button
                    onClick={() => setFilterCategory(filterCategory === 'security' ? null : 'security')}
                    className={`px-1.5 py-0.5 text-xs font-normal rounded transition-colors ${
                      filterCategory === 'security'
                        ? 'bg-red-500/30 text-red-400 border border-red-500/50'
                        : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                    }`}
                    title="Filter security issues"
                  >
                    Security ({findingsByCategory.security})
                  </button>
                )}
                {findingsByCategory.performance > 0 && (
                  <button
                    onClick={() => setFilterCategory(filterCategory === 'performance' ? null : 'performance')}
                    className={`px-1.5 py-0.5 text-xs font-normal rounded transition-colors ${
                      filterCategory === 'performance'
                        ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50'
                        : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                    }`}
                    title="Filter performance issues"
                  >
                    Performance ({findingsByCategory.performance})
                  </button>
                )}
                {findingsByCategory.documentation > 0 && (
                  <button
                    onClick={() => setFilterCategory(filterCategory === 'documentation' ? null : 'documentation')}
                    className={`px-1.5 py-0.5 text-xs font-normal rounded transition-colors ${
                      filterCategory === 'documentation'
                        ? 'bg-purple-500/30 text-purple-400 border border-purple-500/50'
                        : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                    }`}
                    title="Filter documentation suggestions"
                  >
                    📝 Documentation ({findingsByCategory.documentation})
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 relative z-10">
              {Object.entries(findingsByCategory).map(([category, count]) => {
                const isSecurity = category === 'security';
                const isPerformance = category === 'performance';
                const isDocumentation = category === 'documentation';
                const isBestPractices = category === 'best-practices';
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Find first finding with this category (from all findings, not just filtered)
                      const firstFinding = (review?.findings || []).find(f => (f.category || 'other') === category)
                      if (firstFinding?.lineNumber) {
                        setHighlightedLine(firstFinding.lineNumber)
                        setTimeout(() => setHighlightedLine(null), 3000)
                      }
                    }}
                    className={`flex items-center gap-1 px-2 py-1 border cursor-pointer transition-colors text-xs font-normal relative z-20 ${
                      isSecurity 
                        ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' 
                        : isPerformance
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
                        : isDocumentation
                        ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
                        : isBestPractices
                        ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                        : 'bg-cursor-bg-tertiary border-cursor-border hover:bg-cursor-hover text-cursor-text-primary'
                    }`}
                  >
                    <span className="text-xs">{getCategoryIcon(category)}</span>
                    <span className="text-xs capitalize">{category.replace('-', ' ')}</span>
                    <span className="text-xs vscode-badge ml-1">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Findings - VS Code Style */}
        {securityAndPerformanceFindings && securityAndPerformanceFindings.length > 0 && (
          <div className="bg-cursor-bg-secondary p-3 mb-3 border border-cursor-border relative z-0">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-cursor-border">
              <h3 className="text-xs font-normal text-cursor-text-primary uppercase tracking-wider">
                Issues Found ({securityAndPerformanceFindings.length})
                {securityAndPerformanceFindings.some(f => f.category === 'documentation') && (
                  <span className="text-xs font-normal text-cursor-text-muted ml-2 normal-case">
                    (includes Documentation suggestions)
                  </span>
                )}
              </h3>
            </div>
            <div className="space-y-2 relative z-0">
              {securityAndPerformanceFindings.map((finding, index) => (
                <div
                  key={finding._id || index}
                  className={`border-l-4 p-2 transition-colors relative z-0 ${
                    finding.severity === 'critical'
                      ? 'border-red-500 bg-red-500/10'
                      : finding.severity === 'high'
                      ? 'border-orange-500 bg-orange-500/10'
                      : finding.severity === 'medium'
                      ? 'border-yellow-500 bg-yellow-500/10'
                      : 'border-blue-500 bg-blue-500/10'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {finding.lineNumber && (
                        <button
                          onClick={() => {
                            setHighlightedLine(finding.lineNumber)
                            setTimeout(() => {
                              const codeViewer = document.querySelector('[data-code-viewer]')
                              if (codeViewer) {
                                codeViewer.scrollIntoView({ behavior: 'smooth', block: 'start' })
                              }
                            }, 100)
                          }}
                          className={`font-mono text-xs font-normal px-1.5 py-0.5 vscode-badge cursor-pointer hover:opacity-80 transition-opacity ${
                            finding.severity === 'critical'
                              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                              : finding.severity === 'high'
                              ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                              : finding.severity === 'medium'
                              ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                              : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                          }`}
                          title={`Jump to line ${finding.lineNumber}`}
                        >
                          L{finding.lineNumber}
                        </button>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 font-normal uppercase vscode-badge ${
                        finding.severity === 'critical'
                          ? 'bg-red-500/20 text-red-400'
                          : finding.severity === 'high'
                          ? 'bg-orange-500/20 text-orange-400'
                          : finding.severity === 'medium'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {finding.severity}
                      </span>
                      {finding.category && (
                        <span className={`text-xs px-1.5 py-0.5 font-normal vscode-badge ${
                          finding.category === 'security'
                            ? 'bg-red-500/20 text-red-400'
                            : finding.category === 'performance'
                            ? 'bg-blue-500/20 text-blue-400'
                            : finding.category === 'documentation'
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-cursor-bg-tertiary text-cursor-text-primary'
                        }`}>
                          {finding.category.replace('-', ' ')}
                        </span>
                      )}
                      {finding.effortEstimation && (
                        <span className={`text-xs px-1.5 py-0.5 font-normal vscode-badge ${
                          finding.effortEstimation === 'trivial' ? 'bg-green-500/20 text-green-400' :
                          finding.effortEstimation === 'low' ? 'bg-blue-500/20 text-blue-400' :
                          finding.effortEstimation === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-orange-500/20 text-orange-400'
                        }`}>
                          {finding.effortEstimation}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="mb-1.5">
                    <p className="text-xs text-cursor-text-primary font-normal mb-1.5 break-words">{finding.message}</p>
                    
                    {finding.impact && (
                      <div className={`mt-1.5 p-2 border ${
                        finding.severity === 'critical'
                          ? 'bg-red-500/10 border-red-500/30'
                          : finding.severity === 'high'
                          ? 'bg-orange-500/10 border-orange-500/30'
                          : 'bg-yellow-500/10 border-yellow-500/30'
                      }`}>
                        <p className={`text-xs font-normal mb-1 uppercase tracking-wide ${
                          finding.severity === 'critical'
                            ? 'text-red-400'
                            : finding.severity === 'high'
                            ? 'text-orange-400'
                            : 'text-yellow-400'
                        }`}>Impact</p>
                        <p className="text-xs text-cursor-text-primary break-words whitespace-normal">{finding.impact}</p>
                      </div>
                    )}
                    
                    {finding.suggestion && (
                      <div className={`mt-1.5 p-2 border ${
                        finding.severity === 'critical'
                          ? 'bg-red-500/10 border-red-500/30'
                          : finding.severity === 'high'
                          ? 'bg-orange-500/10 border-orange-500/30'
                          : finding.severity === 'medium'
                          ? 'bg-yellow-500/10 border-yellow-500/30'
                          : 'bg-blue-500/10 border-blue-500/30'
                      }`}>
                        <p className={`text-xs font-normal mb-1 uppercase tracking-wide ${
                          finding.severity === 'critical'
                            ? 'text-red-400'
                            : finding.severity === 'high'
                            ? 'text-orange-400'
                            : finding.severity === 'medium'
                            ? 'text-yellow-400'
                            : 'text-blue-400'
                        }`}>Recommendation</p>
                        <p className="text-xs text-cursor-text-primary break-words whitespace-normal">{finding.suggestion}</p>
                      </div>
                    )}
                  </div>
                  
                  {finding.guidelines && finding.guidelines.length > 0 && (
                    <div className="mt-1.5 pt-1.5 border-t border-cursor-border/50">
                      <span className="text-xs text-cursor-text-muted mr-1.5">Guidelines:</span>
                      {finding.guidelines.map((guideline, idx) => (
                        <span key={idx} className="text-xs bg-cursor-bg-tertiary text-cursor-accent px-1 py-0.5 mr-1 vscode-badge">
                          {guideline}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {(!securityAndPerformanceFindings || securityAndPerformanceFindings.length === 0) && (
          <div className="bg-green-500/10 border border-green-500/30 p-3 mb-3">
            <p className="text-green-400 font-normal text-xs mb-1">No Issues Found</p>
            <p className="text-cursor-text-secondary text-xs">
              {review.findings && review.findings.length > 0 
                ? 'Syntax errors and style issues were filtered out. No security vulnerabilities, performance issues, or documentation updates needed in this file.'
                : 'No security vulnerabilities, performance issues, or documentation updates needed in this file.'}
            </p>
          </div>
        )}

        {/* Code Viewer */}
        <div className="bg-cursor-bg-secondary border border-cursor-border overflow-hidden" data-code-viewer>
          <h3 className="text-xs font-normal p-2 border-b border-cursor-border text-cursor-text-secondary uppercase tracking-wider bg-cursor-bg-tertiary">
            Source Code
          </h3>
          <div className="h-[500px]">
            <CodeViewer 
              code={codeContent} 
              language={review.language}
              highlightedLines={securityAndPerformanceFindings
                .filter(f => f.lineNumber && typeof f.lineNumber === 'number' && f.lineNumber > 0)
                .map(f => f.lineNumber)
                .concat(highlightedLine ? [highlightedLine] : [])
                .filter((v, i, a) => a.indexOf(v) === i)
                .sort((a, b) => a - b)}
              highlightedLinesWithSeverity={securityAndPerformanceFindings
                .filter(f => f.lineNumber && typeof f.lineNumber === 'number' && f.lineNumber > 0)
                .reduce((acc, f) => {
                  // Use highest severity if multiple findings on same line
                  const severityOrder = ['critical', 'high', 'medium', 'low'];
                  if (!acc[f.lineNumber] || 
                      severityOrder.indexOf(f.severity || 'medium') < 
                      severityOrder.indexOf(acc[f.lineNumber] || 'low')) {
                    acc[f.lineNumber] = f.severity || 'medium';
                  }
                  return acc;
                }, {})}
              editable={true}
              onCodeChange={handleCodeChange}
            />
          </div>
        </div>
      </div>

      {/* LLM Chat Section - Collapsible */}
      {review && showChat && (
        <div className="bg-cursor-bg-secondary border border-cursor-border overflow-hidden mt-3">
          <LLMChat
            filePath={filePath}
            codeContent={codeContent}
            language={review.language}
            findings={review.findings || []}
          />
        </div>
      )}

      {/* Workspace Manager Modal for Guidelines */}
      {showWorkspaceManager && (
        <WorkspaceManager
          onClose={() => setShowWorkspaceManager(false)}
          onWorkspaceAdded={async () => {
            setShowWorkspaceManager(false)
          }}
        />
      )}
    </div>
  )
}
