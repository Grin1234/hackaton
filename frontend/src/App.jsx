import { useEffect, useState } from 'react'
import MainWindow from './pages/MainWindow'
import './index.css'

function App() {
  const [isElectron, setIsElectron] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    console.log('App component mounting...')
    console.log('window.electronAPI:', window.electronAPI)
    
    // Wait a bit for preload script to initialize
    const checkElectron = () => {
      const hasElectronAPI = typeof window !== 'undefined' && window.electronAPI !== undefined
      console.log('Checking Electron API:', hasElectronAPI)
      setIsElectron(hasElectronAPI)
      setIsReady(true)
    }
    
    // Check immediately
    checkElectron()
    
    // Also check after a short delay (in case preload loads asynchronously)
    const timeout = setTimeout(checkElectron, 100)
    
    return () => clearTimeout(timeout)
  }, [])

  if (!isReady) {
    return (
      <div className="min-h-screen bg-cursor-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cursor-accent mx-auto mb-4"></div>
          <p className="text-cursor-text-primary">Loading...</p>
        </div>
      </div>
    )
  }

  if (isElectron) {
    // Desktop app mode
    return <MainWindow />
  }

  // Web app mode (fallback - show message)
  return (
    <div className="min-h-screen bg-cursor-bg-primary flex items-center justify-center">
      <div className="text-center p-8">
        <h1 className="text-2xl font-bold mb-4 text-cursor-text-primary">AI Code Review Assistant</h1>
        <p className="text-cursor-text-secondary mb-4">Please run this application in Electron desktop mode.</p>
        <div className="bg-cursor-bg-secondary border border-cursor-border rounded-lg p-4 text-left max-w-md mx-auto">
          <p className="text-sm text-cursor-text-primary mb-2"><strong>To start:</strong></p>
          <code className="text-xs bg-cursor-bg-primary text-cursor-success p-2 rounded block border border-cursor-border">
            npm run dev
          </code>
          <p className="text-xs text-cursor-text-muted mt-2">Or separately:</p>
          <code className="text-xs bg-cursor-bg-primary text-cursor-success p-2 rounded block mt-1 border border-cursor-border">
            npm run dev:frontend<br />
            npm run dev:electron
          </code>
        </div>
      </div>
    </div>
  )
}

export default App
