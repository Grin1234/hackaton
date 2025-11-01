import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

console.log('React app starting...')
console.log('window.electronAPI:', window.electronAPI)

const rootElement = document.getElementById('root')
if (!rootElement) {
  console.error('Root element not found!')
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

