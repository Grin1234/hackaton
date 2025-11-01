import { useState, useEffect, useRef } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism'

export default function CodeViewer({ code, language, highlightedLines = [], highlightedLinesWithSeverity = {}, editable = false, onCodeChange }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedCode, setEditedCode] = useState(code || '')
  const textareaRef = useRef(null)
  const codeContainerRef = useRef(null)

  useEffect(() => {
    setEditedCode(code || '')
  }, [code])

  useEffect(() => {
    // Scroll to highlighted line when it changes
    if (highlightedLines.length > 0 && codeContainerRef.current && !isEditing) {
      const lineNumber = highlightedLines[0]
      const lineHeight = 24 // Approximate line height
      const scrollTop = (lineNumber - 1) * lineHeight - 200 // Offset for better visibility
      codeContainerRef.current.scrollTop = scrollTop
    }
  }, [highlightedLines, isEditing])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      // Scroll to highlighted line if any
      if (highlightedLines.length > 0) {
        const lineNumber = highlightedLines[0]
        const lineHeight = 21
        const scrollTop = (lineNumber - 1) * lineHeight - 100
        textareaRef.current.scrollTop = scrollTop
      }
    }
  }, [isEditing, highlightedLines])

  const handleSave = () => {
    if (onCodeChange) {
      onCodeChange(editedCode)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedCode(code)
    setIsEditing(false)
  }

  // Create custom line props for highlighting with severity-based colors
  const lineProps = (lineObj) => {
    const lineNum = typeof lineObj === 'object' && lineObj !== null && lineObj.lineNumber 
      ? lineObj.lineNumber 
      : (typeof lineObj === 'number' ? lineObj : null);
    
    if (lineNum === null) {
      return {};
    }
    
    const isHighlighted = highlightedLines.includes(lineNum);
    const severity = highlightedLinesWithSeverity[lineNum];
    
    if (isHighlighted) {
      // Define colors based on severity
      const severityColors = {
        critical: {
          bg: 'rgba(244, 67, 54, 0.3)', // Red - more visible
          border: '#f44336',
        },
        high: {
          bg: 'rgba(255, 152, 0, 0.3)', // Orange - more visible
          border: '#ff9800',
        },
        medium: {
          bg: 'rgba(255, 193, 7, 0.3)', // Yellow - more visible
          border: '#ffc107',
        },
        low: {
          bg: 'rgba(33, 150, 243, 0.3)', // Blue - more visible
          border: '#2196f3',
        }
      };
      
      const colors = severityColors[severity] || severityColors.medium;
      
      console.log(`Highlighting line ${lineNum} with severity ${severity}`, colors);
      
      return {
        style: {
          display: 'block',
          backgroundColor: colors.bg,
          borderLeft: `4px solid ${colors.border}`,
          paddingLeft: '0.5rem',
          marginLeft: '-1rem',
          paddingRight: '0.5rem',
          marginRight: '-1rem',
          paddingTop: '0.25rem',
          paddingBottom: '0.25rem',
          width: '100%',
          margin: '0',
          boxSizing: 'border-box',
        },
        className: `highlighted-line severity-${severity || 'medium'}`
      }
    }
    return {}
  }

  // Debug: log highlighted lines
  useEffect(() => {
    if (highlightedLines.length > 0) {
      console.log('CodeViewer highlighted lines:', highlightedLines)
      console.log('CodeViewer severity map:', highlightedLinesWithSeverity)
      console.log('CodeViewer code length:', code?.split('\n').length)
    }
  }, [highlightedLines, highlightedLinesWithSeverity, code])

  // Handle code changes with proper cursor position
  const handleTextareaChange = (e) => {
    const newValue = e.target.value
    setEditedCode(newValue)
    
    // Restore cursor position
    const cursorPosition = e.target.selectionStart
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(cursorPosition, cursorPosition)
      }
    }, 0)
  }

  if (editable && isEditing) {
    const lines = editedCode.split('\n')
    const maxLineNumberWidth = String(lines.length).length
    
    return (
      <div className="flex flex-col h-full bg-[#1e1e1e]">
        <div className="flex justify-between items-center p-2 border-b border-cursor-border bg-cursor-bg-secondary">
          <span className="text-xs font-medium text-cursor-text-secondary">Editing Code</span>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-2 py-1 text-xs border border-cursor-border rounded hover:bg-cursor-hover text-cursor-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-2 py-1 text-xs bg-cursor-accent text-white rounded hover:bg-cursor-accent-hover transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto relative" style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}>
          {/* Line numbers overlay */}
          <div
            className="absolute left-0 top-0 bottom-0 px-4 py-4 pointer-events-none select-none text-right z-10"
            style={{
              fontSize: '0.875rem',
              lineHeight: '1.5',
              color: '#858585',
              borderRight: '1px solid #3e3e3e',
              background: '#252526',
              minWidth: `${maxLineNumberWidth * 0.6 + 2}em`,
            }}
          >
            {lines.map((_, idx) => (
              <div
                key={idx}
                style={{
                  height: '21px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  color: highlightedLines.includes(idx + 1) ? '#ffc107' : '#858585',
                  fontWeight: highlightedLines.includes(idx + 1) ? 'bold' : 'normal',
                  backgroundColor: highlightedLines.includes(idx + 1) ? 'rgba(255, 193, 7, 0.2)' : 'transparent',
                }}
              >
                {idx + 1}
              </div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={editedCode}
            onChange={handleTextareaChange}
            className="absolute inset-0 w-full h-full border-0 resize-none focus:outline-none bg-transparent text-[#d4d4d4]"
            style={{
              fontSize: '0.875rem',
              lineHeight: '1.5',
              tabSize: 2,
              paddingLeft: `${maxLineNumberWidth * 0.6 + 3}em`,
              paddingRight: '1rem',
              paddingTop: '1rem',
              paddingBottom: '1rem',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            }}
            spellCheck={false}
            wrap="off"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {editable && !isEditing && (
        <div className="flex justify-end p-2 bg-cursor-bg-secondary border-b border-cursor-border">
          <button
            onClick={() => setIsEditing(true)}
            className="px-2 py-1 text-xs bg-cursor-accent text-white rounded hover:bg-cursor-accent-hover flex items-center gap-1.5 transition-colors"
          >
            <span className="text-xs">▸</span>
            <span>Edit Code</span>
          </button>
        </div>
      )}
      <div className="overflow-auto flex-1 relative" ref={codeContainerRef}>
        <style>{`
          .highlighted-line {
            position: relative;
            display: block !important;
            width: 100% !important;
          }
          .highlighted-line.severity-critical {
            background-color: rgba(244, 67, 54, 0.25) !important;
            border-left: 4px solid #f44336 !important;
          }
          .highlighted-line.severity-high {
            background-color: rgba(255, 152, 0, 0.25) !important;
            border-left: 4px solid #ff9800 !important;
          }
          .highlighted-line.severity-medium {
            background-color: rgba(255, 193, 7, 0.25) !important;
            border-left: 4px solid #ffc107 !important;
          }
          .highlighted-line.severity-low {
            background-color: rgba(33, 150, 243, 0.25) !important;
            border-left: 4px solid #2196f3 !important;
          }
          .token-line {
            display: block !important;
          }
        `}</style>
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '1rem',
            borderRadius: '0',
            fontSize: '0.875rem',
            background: '#1e1e1e',
          }}
          showLineNumbers
          lineNumberStyle={{ minWidth: '3em', color: '#858585' }}
          lineProps={lineProps}
          wrapLines={true}
          wrapLongLines={true}
        >
          {code || ''}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

