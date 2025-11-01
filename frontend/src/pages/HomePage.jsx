import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="text-center py-8">
      <h1 className="text-3xl font-bold text-cursor-text-primary mb-3">
        AI-Powered Code Review Assistant
      </h1>
      <p className="text-base text-cursor-text-secondary mb-6">
        Upload your code and get instant AI-powered reviews using Ollama
      </p>
      <div className="space-x-4">
        <Link
          to="/upload"
          className="inline-block bg-cursor-accent text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-cursor-accent-hover transition"
        >
          Start Review
        </Link>
      </div>
      
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
        <div className="bg-cursor-bg-secondary p-4 rounded-lg shadow-lg border border-cursor-border">
          <h3 className="text-sm font-semibold mb-2 text-cursor-text-primary">◉ AI-Powered</h3>
          <p className="text-xs text-cursor-text-secondary">
            Uses locally hosted Ollama LLM for privacy and performance
          </p>
        </div>
        <div className="bg-cursor-bg-secondary p-4 rounded-lg shadow-lg border border-cursor-border">
          <h3 className="text-sm font-semibold mb-2 text-cursor-text-primary">▲ Fast Reviews</h3>
          <p className="text-xs text-cursor-text-secondary">
            Get comprehensive code reviews in seconds
          </p>
        </div>
        <div className="bg-cursor-bg-secondary p-4 rounded-lg shadow-lg border border-cursor-border">
          <h3 className="text-sm font-semibold mb-2 text-cursor-text-primary">• Private</h3>
          <p className="text-xs text-cursor-text-secondary">
            Your code stays on your machine - no cloud uploads
          </p>
        </div>
      </div>
    </div>
  )
}

