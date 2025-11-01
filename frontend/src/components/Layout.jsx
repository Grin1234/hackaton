import '../index.css'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-cursor-bg-primary">
      <nav className="bg-cursor-bg-secondary border-b border-cursor-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-12">
            <div className="flex items-center">
              <h1 className="text-sm font-semibold text-cursor-text-primary">
                AI Code Review Assistant
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="/"
                className="text-xs text-cursor-text-secondary hover:text-cursor-text-primary px-3 py-2 rounded-md font-medium transition-colors"
              >
                Home
              </a>
              <a
                href="/upload"
                className="bg-cursor-accent text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-cursor-accent-hover transition-colors"
              >
                Upload Code
              </a>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  )
}

