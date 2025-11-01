import { useState, useEffect } from 'react'

export default function WorkspaceManager({ onClose, onWorkspaceAdded }) {
  const [path, setPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState(null)
  const [workspaceSettings, setWorkspaceSettings] = useState({
    autoReview: true,
    notificationEnabled: true,
    customGuidelines: []
  })
  const [guidelinesText, setGuidelinesText] = useState('')
  const [autoStart, setAutoStart] = useState(false)

  useEffect(() => {
    loadWorkspaces()
    loadAutoStart()
  }, [])

  const loadWorkspaces = async () => {
    if (window.electronAPI && window.electronAPI.workspace) {
      try {
        const ws = await window.electronAPI.workspace.list()
        setWorkspaces(ws || [])
      } catch (err) {
        console.error('Failed to load workspaces:', err)
      }
    }
  }

  const loadAutoStart = async () => {
    if (window.electronAPI && window.electronAPI.app) {
      try {
        const result = await window.electronAPI.app.getAutoStart()
        setAutoStart(result.enabled || false)
      } catch (err) {
        console.error('Failed to load auto-start:', err)
      }
    }
  }

  const handleToggleAutoStart = async () => {
    if (window.electronAPI && window.electronAPI.app) {
      try {
        const result = await window.electronAPI.app.setAutoStart(!autoStart)
        if (result.success) {
          setAutoStart(!autoStart)
        }
      } catch (err) {
        alert('Failed to update auto-start: ' + err.message)
      }
    }
  }

  const handleUpdateWorkspaceSettings = async () => {
    if (!selectedWorkspace || !window.electronAPI || !window.electronAPI.workspaceSettings) return
    
    try {
      const result = await window.electronAPI.workspaceSettings.update(selectedWorkspace.path, workspaceSettings)
      if (result.success) {
        alert('Settings updated successfully!')
        setShowSettings(false)
        setSelectedWorkspace(null)
        await loadWorkspaces()
      } else {
        alert('Failed to update settings: ' + result.error)
      }
    } catch (err) {
      alert('Error updating settings: ' + err.message)
    }
  }

  const handleOpenSettings = (workspace) => {
    setSelectedWorkspace(workspace)
    setWorkspaceSettings({
      autoReview: workspace.autoReview !== false,
      notificationEnabled: workspace.notificationEnabled !== false,
      customGuidelines: workspace.customGuidelines || []
    })
    setGuidelinesText((workspace.customGuidelines || []).join('\n'))
    setShowSettings(true)
  }

  const handleBrowse = async () => {
    if (window.electronAPI && window.electronAPI.dialog) {
      const result = await window.electronAPI.dialog.showOpenDialog({
        properties: ['openDirectory']
      })
      
      if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
        setPath(result.filePaths[0])
      }
    } else {
      // Fallback: prompt
      const input = prompt('Enter workspace path:')
      if (input) {
        setPath(input)
      }
    }
  }

  const handleAdd = async () => {
    if (!path.trim()) {
      setError('Please enter a workspace path')
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (window.electronAPI) {
        const workspace = await window.electronAPI.workspace.add(path)
        if (workspace) {
          // Success - workspace added or already exists (which is fine)
          onWorkspaceAdded()
          setPath('') // Clear path
        }
      }
    } catch (err) {
      // Show user-friendly error message
      const errorMsg = err.message || 'Failed to add workspace'
      if (errorMsg.includes('already exists')) {
        setError('This workspace is already added. It will be shown in the list.')
        // Still refresh - the workspace exists
        setTimeout(() => {
          onWorkspaceAdded()
          setPath('')
        }, 1500)
      } else {
        setError(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-cursor-bg-secondary rounded-xl border border-cursor-border shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-cursor-text-primary">Workspace Manager</h2>
          <button
            onClick={onClose}
            className="text-cursor-text-muted hover:text-cursor-text-primary text-2xl font-light w-8 h-8 flex items-center justify-center rounded-md hover:bg-cursor-hover transition-all duration-200"
          >
            ×
          </button>
        </div>
        
        {!showSettings ? (
          <>
            {/* Workspace List */}
            {workspaces.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-cursor-text-primary mb-3 uppercase tracking-wider">Current Workspaces</h3>
                <div className="space-y-2">
                  {workspaces.map((workspace) => (
                    <div
                      key={workspace.path || workspace._id}
                      className="flex justify-between items-center p-4 bg-cursor-bg-primary rounded-lg border border-cursor-border hover:border-cursor-accent transition-all duration-200 group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-cursor-text-primary mb-1 truncate">{workspace.name}</p>
                        <p className="text-xs text-cursor-text-muted truncate">{workspace.path}</p>
                      </div>
                      <button
                        onClick={() => handleOpenSettings(workspace)}
                        className="px-4 py-2 bg-cursor-bg-tertiary hover:bg-cursor-accent hover:text-white text-cursor-text-primary rounded-md text-xs font-medium transition-all duration-200 ml-3 border border-cursor-border hover:border-cursor-accent"
                      >
                        Settings
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Workspace Form */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-cursor-text-primary uppercase tracking-wider">Add Workspace</h3>
              <div>
                <label className="block text-sm font-medium text-cursor-text-secondary mb-2">
                  Workspace Path
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder="/path/to/workspace"
                    className="flex-1 bg-cursor-bg-primary border border-cursor-border text-cursor-text-primary rounded-md px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cursor-accent focus:border-cursor-accent transition-all"
                  />
                  <button
                    onClick={handleBrowse}
                    className="px-4 py-2.5 bg-cursor-bg-tertiary hover:bg-cursor-hover text-cursor-text-primary rounded-md text-sm font-medium transition-all duration-200 border border-cursor-border hover:border-cursor-accent"
                  >
                    Browse
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/20 border-2 border-red-500/40 text-red-400 px-4 py-3 rounded-lg">
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              {/* Auto-start Setting */}
              <div className="flex items-center justify-between p-4 bg-cursor-bg-primary rounded-lg border border-cursor-border">
                <div>
                  <p className="text-sm font-semibold text-cursor-text-primary mb-1">Auto-start on Boot</p>
                  <p className="text-xs text-cursor-text-muted">Start the app automatically when you log in</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoStart}
                    onChange={handleToggleAutoStart}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-cursor-bg-tertiary peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cursor-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-cursor-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cursor-accent"></div>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 border border-cursor-border rounded-md hover:bg-cursor-hover text-cursor-text-primary transition-all duration-200 text-sm font-medium"
                >
                  Close
                </button>
                <button
                  onClick={handleAdd}
                  disabled={loading}
                  className="px-4 py-2.5 bg-cursor-accent text-white rounded-md hover:bg-cursor-accent-hover disabled:bg-cursor-text-muted transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg disabled:shadow-none"
                >
                  {loading ? 'Adding...' : 'Add Workspace'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-cursor-text-primary uppercase tracking-wider">
              Settings for {selectedWorkspace?.name}
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-cursor-bg-primary rounded-lg border border-cursor-border">
                <div>
                  <p className="text-sm font-semibold text-cursor-text-primary mb-1">Auto-review on Save</p>
                  <p className="text-xs text-cursor-text-muted">Automatically review files when they are saved</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={workspaceSettings.autoReview}
                    onChange={(e) => setWorkspaceSettings({ ...workspaceSettings, autoReview: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-cursor-bg-tertiary peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cursor-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-cursor-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cursor-accent"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-cursor-bg-primary rounded-lg border border-cursor-border">
                <div>
                  <p className="text-sm font-semibold text-cursor-text-primary mb-1">Notifications</p>
                  <p className="text-xs text-cursor-text-muted">Show desktop notifications for critical/high issues</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={workspaceSettings.notificationEnabled}
                    onChange={(e) => setWorkspaceSettings({ ...workspaceSettings, notificationEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-cursor-bg-tertiary peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cursor-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-cursor-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cursor-accent"></div>
                </label>
              </div>

              <div className="p-4 bg-cursor-bg-primary rounded-lg border border-cursor-border">
                <div className="mb-2">
                  <p className="text-sm font-semibold text-cursor-text-primary mb-1">Custom Guidelines Import</p>
                  <p className="text-xs text-cursor-text-muted mb-2">
                    Add custom coding guidelines (one per line). These will be applied during code reviews alongside standard guidelines.
                  </p>
                  <p className="text-xs text-cursor-accent mb-2 font-medium">
                    ✓ Guidelines are used in all future reviews for this workspace
                  </p>
                </div>
                <textarea
                  value={guidelinesText}
                  onChange={(e) => setGuidelinesText(e.target.value)}
                  placeholder="Example:&#10;All functions must have JSDoc comments&#10;Use const instead of let when possible&#10;Maximum function length: 50 lines&#10;All public APIs must be documented&#10;Error handling must be explicit"
                  className="w-full h-32 px-3 py-2 bg-cursor-bg-secondary border border-cursor-border rounded text-xs text-cursor-text-primary font-mono resize-none focus:outline-none focus:ring-2 focus:ring-cursor-accent/50"
                />
                <p className="text-xs text-cursor-text-muted mt-2">
                  {guidelinesText.split('\n').filter(l => l.trim().length > 0).length} guideline(s) entered
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => {
                  setShowSettings(false)
                  setSelectedWorkspace(null)
                }}
                className="px-4 py-2.5 border border-cursor-border rounded-md hover:bg-cursor-hover text-cursor-text-primary transition-all duration-200 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateWorkspaceSettings}
                className="px-4 py-2.5 bg-cursor-accent text-white rounded-md hover:bg-cursor-accent-hover transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg"
              >
                Save Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
