import { useState, useEffect, useCallback } from 'react'
import FileTree from '../components/FileTree'
import ReviewPanel from '../components/ReviewPanel'
import WorkspaceManager from '../components/WorkspaceManager'

export default function MainWindow() {
  const [workspaces, setWorkspaces] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedReview, setSelectedReview] = useState(null)
  const [showWorkspaceManager, setShowWorkspaceManager] = useState(false)
  const [error, setError] = useState(null)
  const [servicesReady, setServicesReady] = useState(false)

  const loadWorkspaces = useCallback(async () => {
    try {
      if (window.electronAPI) {
        const ws = await window.electronAPI.workspace.list()
        setWorkspaces(ws || [])
        setError(null)
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err)
      setError('Failed to load workspaces: ' + err.message)
    }
  }, [])

  const loadReview = useCallback(async (filePath) => {
    try {
      if (window.electronAPI) {
        const review = await window.electronAPI.file.getReview(filePath)
        setSelectedReview(review)
      }
    } catch (err) {
      console.error('Failed to load review:', err)
    }
  }, [])

  const handleFileSelect = useCallback(async (filePath) => {
    setSelectedFile(filePath)
    await loadReview(filePath)
  }, [loadReview])

  const handleRemoveWorkspace = useCallback(async (workspacePath) => {
    if (window.electronAPI && confirm(`Remove workspace "${workspacePath}"?`)) {
      try {
        await window.electronAPI.workspace.remove(workspacePath)
        await loadWorkspaces()
      } catch (err) {
        console.error('Failed to remove workspace:', err)
        alert('Failed to remove workspace: ' + err.message)
      }
    }
  }, [loadWorkspaces])

  useEffect(() => {
    console.log('MainWindow mounted, electronAPI:', window.electronAPI)
    
    // Check if Electron API is available
    if (!window.electronAPI) {
      console.error('Electron API not available')
      setError('Electron API not available. Please run in Electron environment.')
      return
    }

    // Listen for services ready signal
    const handleServicesReady = () => {
      console.log('✅ Services ready signal received! Setting servicesReady=true and loading workspaces...')
      setServicesReady(true)
      loadWorkspaces()
    }

    // Listen for errors
    const handleError = (event, errorData) => {
      console.error('App error:', errorData)
      setError(errorData.message || 'An error occurred')
    }

    // Listen for file changes
    const handleFileChanged = (filePath) => {
      console.log('File changed:', filePath)
      loadWorkspaces()
    }

    const handleFileReviewed = (filePath, review) => {
      console.log('File reviewed:', filePath, review)
      // Refresh file list to show updated status
      loadWorkspaces()
      // If this is the selected file, reload its review
      if (selectedFile === filePath) {
        loadReview(filePath)
      }
    }

    // Listen for review events
    const handleReviewReady = (data) => {
      console.log('Review ready:', data)
      if (data && data.filePath) {
        handleFileReviewed(data.filePath, data.review)
      }
    }

    // Register IPC listeners
    if (window.electronAPI && window.electronAPI.review) {
      window.electronAPI.review.onReviewReady(handleReviewReady)
      window.electronAPI.review.onReviewStarted((item) => {
        console.log('Review started:', item.filePath)
      })
      window.electronAPI.review.onReviewFailed((data) => {
        console.error('Review failed:', data)
      })
    }
    
    if (window.electronAPI && window.electronAPI.file) {
      window.electronAPI.file.onChanged(handleFileChanged)
      window.electronAPI.file.onReviewed(handleFileReviewed)
    }
    
    // Initial load check - try to load workspaces immediately
    if (window.electronAPI && window.electronAPI.workspace) {
      window.electronAPI.workspace.list()
        .then(() => {
          setServicesReady(true)
          loadWorkspaces()
        })
        .catch(() => {
          // Services not ready yet, will retry below
        })
    }
    
    // Also check if signal was already sent (race condition protection)
    // If window was created after services initialized, signal might have been missed
    // So we'll also check after a delay
    let checkServicesReadyTimeout
    if (!servicesReady) {
      checkServicesReadyTimeout = setTimeout(() => {
        if (window.electronAPI) {
          console.log('Checking if services are ready (fallback check)...')
          // Try a simple call to see if services are ready
          window.electronAPI.workspace.list()
            .then(() => {
              console.log('✅ Services appear ready (fallback check succeeded)')
              setServicesReady(true)
              loadWorkspaces()
            })
            .catch(() => {
              console.log('Services not ready yet (fallback check failed)')
            })
        }
      }, 1000)
    }

    return () => {
      if (checkServicesReadyTimeout) {
        clearTimeout(checkServicesReadyTimeout)
      }
      // Note: IPC listeners are cleaned up automatically when component unmounts
      // In a production app, you might want to add removeListener methods to preload
    }
  }, [selectedFile, loadWorkspaces, loadReview, servicesReady])

  if (error) {
    return (
      <div className="flex h-screen bg-cursor-bg-primary items-center justify-center">
        <div className="text-center p-8 bg-cursor-bg-secondary rounded-xl border border-cursor-border shadow-lg max-w-md animate-fade-in">
          <div className="text-lg mb-2 text-cursor-error">⚠</div>
          <h2 className="text-xl font-bold text-cursor-error mb-4">Error</h2>
          <p className="text-cursor-text-primary">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-cursor-bg-primary text-cursor-text-primary overflow-hidden">
      {/* Left Sidebar - File Tree */}
      <div className="w-64 bg-cursor-bg-secondary border-r border-cursor-border flex flex-col vscode-sidebar">
        <div className="px-3 py-2 border-b border-cursor-border">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-normal text-cursor-text-primary uppercase tracking-wider">EXPLORER</h2>
            <button
              onClick={() => setShowWorkspaceManager(true)}
              className="text-cursor-text-secondary hover:text-cursor-text-primary text-sm font-normal px-1 py-0.5 hover:bg-cursor-hover transition-colors"
              title="Add Workspace"
            >
              +
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {workspaces.map((workspace) => (
            <div key={workspace.path || workspace._id || `workspace-${workspace.name}`} className="mb-2">
              <FileTree
                workspace={workspace}
                onFileSelect={handleFileSelect}
                selectedFile={selectedFile}
                servicesReady={servicesReady}
              />
              <div className="ml-4 mt-1 mb-3">
                <button
                  onClick={() => handleRemoveWorkspace(workspace.path)}
                  className="text-xs text-cursor-text-muted hover:text-cursor-error px-2 py-1 rounded-md hover:bg-cursor-hover transition-all duration-200"
                  title="Remove workspace"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {workspaces.length === 0 && (
            <div className="p-6 text-center text-cursor-text-muted">
              <p className="mb-3 text-xs font-normal">No workspaces added</p>
              <button
                onClick={() => setShowWorkspaceManager(true)}
                className="px-3 py-1.5 bg-cursor-accent text-white rounded text-xs font-normal transition-colors hover:bg-cursor-accent-hover"
              >
                Add Workspace
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Review Panel */}
      <div className="flex-1 flex flex-col bg-cursor-bg-primary overflow-hidden">
        {selectedFile ? (
          <ReviewPanel
            filePath={selectedFile}
            review={selectedReview}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-cursor-text-muted">
            <div className="text-center">
              <p className="text-sm mb-1 text-cursor-text-secondary font-normal">Select a file to view review</p>
              <p className="text-xs text-cursor-text-muted">Files are automatically reviewed on save</p>
            </div>
          </div>
        )}
      </div>

      {/* Workspace Manager Modal */}
      {showWorkspaceManager && (
        <WorkspaceManager
          onClose={() => setShowWorkspaceManager(false)}
          onWorkspaceAdded={async () => {
            await loadWorkspaces()
            setShowWorkspaceManager(false)
          }}
        />
      )}
    </div>
  )
}
