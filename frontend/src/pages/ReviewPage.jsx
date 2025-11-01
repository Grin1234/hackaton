import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getReview } from '../services/api'
import CodeViewer from '../components/CodeViewer'
import CommentThread from '../components/CommentThread'

export default function ReviewPage() {
  const { id } = useParams()
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchReview = async () => {
      try {
        const data = await getReview(id)
        setReview(data.review)
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Failed to load review')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchReview()
    }
  }, [id])

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cursor-accent mx-auto"></div>
        <p className="mt-4 text-cursor-text-secondary">Loading review...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-cursor-error bg-opacity-20 border border-cursor-error text-cursor-error px-4 py-3 rounded">
        {error}
      </div>
    )
  }

  if (!review) {
    return <div className="text-cursor-text-primary">Review not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-cursor-text-primary">{review.fileName}</h1>
          <p className="text-sm text-cursor-text-secondary mt-1">
            Language: {review.language} | Status: {review.status}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-cursor-text-muted">
            {new Date(review.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bg-cursor-bg-secondary rounded-lg shadow-lg p-4 border border-cursor-border">
        <h2 className="text-sm font-semibold mb-3 text-cursor-text-primary">Review Summary</h2>
        <div className="prose max-w-none">
          <pre className="whitespace-pre-wrap text-xs text-cursor-text-primary bg-cursor-bg-primary p-3 rounded border border-cursor-border">
            {review.review}
          </pre>
        </div>
      </div>

      {review.findings && review.findings.length > 0 && (
        <div className="bg-cursor-bg-secondary rounded-lg shadow-lg p-4 border border-cursor-border">
          <h2 className="text-sm font-semibold mb-3 text-cursor-text-primary">Findings</h2>
          <div className="space-y-2">
            {review.findings.map((finding, index) => (
              <div
                key={index}
                className={`border-l-4 p-3 rounded-r-lg ${
                  finding.severity === 'critical'
                    ? 'border-critical bg-critical-bg'
                    : finding.severity === 'high'
                    ? 'border-high bg-high-bg'
                    : finding.severity === 'medium'
                    ? 'border-medium bg-medium-bg'
                    : 'border-low bg-low-bg'
                }`}
              >
                <div className="flex justify-between">
                  <span className="text-xs font-medium text-cursor-text-primary">
                    {finding.lineNumber ? `Line ${finding.lineNumber}` : 'General'}
                  </span>
                  <span className={`text-xs capitalize px-2 py-1 rounded ${
                    finding.severity === 'critical'
                      ? 'bg-critical-bg text-critical border border-critical'
                      : finding.severity === 'high'
                      ? 'bg-high-bg text-high border border-high'
                      : finding.severity === 'medium'
                      ? 'bg-medium-bg text-medium border border-medium'
                      : 'bg-low-bg text-low border border-low'
                  }`}>{finding.severity}</span>
                </div>
                <p className="mt-1 text-xs text-cursor-text-primary">{finding.message}</p>
                {finding.suggestion && (
                  <p className="mt-2 text-xs text-cursor-text-secondary">
                    <strong>Suggestion:</strong> {finding.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-cursor-bg-secondary rounded-lg shadow-lg border border-cursor-border">
          <h2 className="text-sm font-semibold p-3 border-b border-cursor-border text-cursor-text-primary">Code</h2>
          <CodeViewer code={review.codeContent} language={review.language} />
        </div>

        <div className="bg-cursor-bg-secondary rounded-lg shadow-lg border border-cursor-border">
          <h2 className="text-sm font-semibold p-3 border-b border-cursor-border text-cursor-text-primary">Comments</h2>
          <div className="p-4">
            {review.comments && review.comments.length > 0 ? (
              <div className="space-y-3">
                {review.comments.map((comment, index) => (
                  <CommentThread key={index} comment={comment} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-cursor-text-muted">No comments yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

