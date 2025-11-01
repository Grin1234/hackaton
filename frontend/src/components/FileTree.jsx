import { useState, useEffect, useCallback } from 'react'

// Browser-compatible path utilities
const basename = (path) => {
  return path.split(/[/\\]/).pop() || path
}

export default function FileTree({ workspace, onFileSelect, selectedFile, servicesReady = false }) {
  const [files, setFiles] = useState([])
  const [expanded, setExpanded] = useState(true)

  const loadFiles = useCallback(async () => {
    // Don't load if services aren't ready yet - be very strict
    if (servicesReady !== true) {
      console.log('FileTree: Skipping loadFiles - services not ready yet (servicesReady:', servicesReady, ')')
      return
    }
    
    if (window.electronAPI && workspace && workspace.path) {
      try {
        const reviews = await window.electronAPI.file.getAllReviews(workspace.path)
        
        // Deduplicate by filePath - keep only the latest review for each file
        const fileMap = new Map()
        if (reviews && reviews.length > 0) {
          reviews.forEach(review => {
            const filePath = review.filePath
            if (!fileMap.has(filePath)) {
              fileMap.set(filePath, review)
            } else {
              // Keep the one with more recent updatedAt
              const existing = fileMap.get(filePath)
              const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0
              const currentTime = review.updatedAt ? new Date(review.updatedAt).getTime() : 0
              if (currentTime > existingTime) {
                fileMap.set(filePath, review)
              }
            }
          })
        }
        
        // Convert map to array
        const uniqueFiles = Array.from(fileMap.values())
        setFiles(uniqueFiles)
      } catch (err) {
        console.error('Failed to load files:', err)
        // Don't set empty array on error - might be temporary connection issue
        // The periodic refresh will retry automatically
        // Only log warning, don't retry here - let periodic refresh handle it
        if (err.message && (err.message.includes('MongoDB connection') || err.message.includes('not ready'))) {
          console.warn('MongoDB connection issue - will retry on next periodic refresh')
        }
      }
    }
  }, [workspace, servicesReady])

  useEffect(() => {
    // Only load if services are ready AND we have a workspace - be very strict
    if (servicesReady !== true) {
      console.log('FileTree useEffect: Waiting for services to be ready... (servicesReady:', servicesReady, ')')
      return
    }
    
    if (!workspace || !workspace.path) {
      console.log('FileTree useEffect: No workspace path provided')
      return
    }
    
    console.log('FileTree useEffect: Loading files for workspace:', workspace.path, '(servicesReady:', servicesReady, ')')
    loadFiles()
    
    // Refresh periodically (only when services are ready)
    const interval = setInterval(() => {
      if (servicesReady === true) {
        loadFiles()
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [workspace, loadFiles, servicesReady])

  // Also listen for file review events
  useEffect(() => {
    if (!window.electronAPI || !workspace?.path) return;
    
    const handleFileReviewed = (filePath, review) => {
      console.log('File reviewed event received:', filePath, review);
      // Refresh the file list when a file is reviewed
      // Normalize paths for comparison
      const normalizedFilePath = filePath.replace(/\\/g, '/');
      const normalizedWorkspacePath = workspace.path.replace(/\\/g, '/');
      
      if (normalizedFilePath.startsWith(normalizedWorkspacePath)) {
        console.log('Refreshing file list for workspace:', workspace.path);
        loadFiles();
      }
    };
    
    window.electronAPI.file.onReviewed(handleFileReviewed);
    
    return () => {
      // Cleanup handled automatically
    };
  }, [workspace?.path, loadFiles]);

  const getFileStatus = (review) => {
    if (!review) return 'pending'
    if (review.status === 'pending' || review.status === 'processing') return 'processing'
    if (review.findings && review.findings.some(f => f.severity === 'critical')) return 'critical'
    if (review.findings && review.findings.some(f => f.severity === 'high')) return 'warning'
    if (review.findings && review.findings.length > 0) return 'info'
    return 'ok'
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'critical':
        return '●'
      case 'warning':
        return '▲'
      case 'info':
        return '•'
      case 'ok':
        return '✓'
      case 'processing':
        return '○'
      default:
        return '○'
    }
  }
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'critical':
        return 'text-red-400'
      case 'warning':
        return 'text-yellow-400'
      case 'info':
        return 'text-blue-400'
      case 'ok':
        return 'text-green-400'
      case 'processing':
        return 'text-cursor-accent animate-pulse'
      default:
        return 'text-cursor-text-muted'
    }
  }

  return (
    <div className="px-1 py-1">
      <div
        className="flex items-center justify-between px-2 py-1 hover:bg-cursor-hover cursor-pointer transition-colors group"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="text-cursor-text-muted text-xs group-hover:text-cursor-text-primary transition-colors flex-shrink-0">
            {expanded ? '▼' : '▶'}
          </span>
          <span className="font-normal text-cursor-text-primary text-xs truncate">{workspace.name}</span>
        </div>
        {workspace.stats && (
          <span className="text-xs text-cursor-text-muted bg-cursor-bg-tertiary px-1.5 py-0.5 rounded flex-shrink-0">
            {workspace.stats.completedReviews}
          </span>
        )}
      </div>

      {expanded && (
        <div className="ml-4 mt-0.5 space-y-0">
          {files.map((review) => {
            const status = getFileStatus(review)
            const fileName = basename(review.filePath)
            
            return (
              <div
                key={review._id || review.filePath}
                className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-colors vscode-list-item ${
                  selectedFile === review.filePath ? 'active' : ''
                }`}
                onClick={() => onFileSelect(review.filePath)}
              >
                <span className={`text-xs flex-shrink-0 font-normal ${getStatusColor(status)}`}>
                  {getStatusIcon(status)}
                </span>
                <span className="text-xs flex-1 truncate">
                  {fileName}
                </span>
                {review.findings && review.findings.length > 0 && (
                  <span className="text-xs text-cursor-text-muted bg-cursor-bg-tertiary px-1.5 py-0.5 rounded flex-shrink-0 font-normal">
                    {review.findings.length}
                  </span>
                )}
              </div>
            )
          })}
          
          {files.length === 0 && (
            <div className="text-xs text-cursor-text-muted px-2 py-2 text-center italic">
              No files reviewed yet
            </div>
          )}
        </div>
      )}
    </div>
  )
}
