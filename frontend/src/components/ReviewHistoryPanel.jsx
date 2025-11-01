import { useState, useEffect } from 'react'

export default function ReviewHistoryPanel({ filePath, onSelectReview }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [filePath])

  const loadHistory = async () => {
    if (window.electronAPI && window.electronAPI.reviewHistory) {
      setLoading(true)
      try {
        const reviews = await window.electronAPI.reviewHistory.get(filePath)
        setHistory(reviews || [])
      } catch (err) {
        console.error('Failed to load review history:', err)
      } finally {
        setLoading(false)
      }
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-cursor-text-muted">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cursor-accent border-t-transparent mx-auto mb-3"></div>
        <p className="text-sm">Loading history...</p>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="p-4 text-center text-cursor-text-muted">
        <p className="text-xs">No review history available</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {history.map((review, index) => (
        <div
          key={review._id || index}
          onClick={() => onSelectReview && onSelectReview(review)}
          className="p-4 bg-cursor-bg-primary rounded-lg border border-cursor-border cursor-pointer hover:bg-cursor-hover transition-all duration-200 hover:shadow-md group animate-fade-in"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${
                review.status === 'completed' ? 'bg-green-500/20 text-green-400 border-green-500/40' :
                review.status === 'failed' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
                'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
              }`}>
                {review.status}
              </span>
              {review.incremental && (
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/40 text-xs font-medium">
                  Incremental
                </span>
              )}
              {review.reviewVersion && (
                <span className="text-xs text-cursor-text-muted bg-cursor-bg-tertiary px-2 py-1 rounded-md border border-cursor-border">
                  v{review.reviewVersion}
                </span>
              )}
            </div>
            <span className="text-xs text-cursor-text-muted group-hover:text-cursor-text-secondary transition-colors">
              {new Date(review.updatedAt).toLocaleDateString()} {new Date(review.updatedAt).toLocaleTimeString()}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-cursor-text-secondary mt-2">
            {review.findings && review.findings.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="text-cursor-text-muted">Findings:</span>
                <span className="font-semibold text-cursor-text-primary">{review.findings.length}</span>
              </span>
            )}
            {review.tokenUsage && review.tokenUsage.totalTokens && (
              <>
                {review.findings && review.findings.length > 0 && (
                  <span className="text-cursor-text-muted">•</span>
                )}
                <span className="flex items-center gap-1.5">
                  <span className="text-cursor-text-muted">Tokens:</span>
                  <span className="font-semibold text-cursor-accent">{review.tokenUsage.totalTokens.toLocaleString()}</span>
                </span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

