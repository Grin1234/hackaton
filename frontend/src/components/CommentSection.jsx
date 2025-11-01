import { useState } from 'react'

export default function CommentSection({ filePath, comments = [], onAddComment, onReply, onResolve }) {
  const [newComment, setNewComment] = useState({ lineNumber: null, content: '', type: 'suggestion' })
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyContent, setReplyContent] = useState('')

  const handleAddComment = async () => {
    if (!newComment.content.trim()) return
    
    if (window.electronAPI && window.electronAPI.comment) {
      try {
        await window.electronAPI.comment.add(filePath, {
          lineNumber: newComment.lineNumber || 0,
          content: newComment.content,
          type: newComment.type
        })
        setNewComment({ lineNumber: null, content: '', type: 'suggestion' })
        if (onAddComment) onAddComment()
      } catch (err) {
        console.error('Failed to add comment:', err)
        alert('Failed to add comment: ' + err.message)
      }
    }
  }

  const handleReply = async (commentIndex) => {
    if (!replyContent.trim()) return
    
    if (window.electronAPI && window.electronAPI.comment) {
      try {
        await window.electronAPI.comment.reply(filePath, commentIndex, replyContent)
        setReplyingTo(null)
        setReplyContent('')
        if (onReply) onReply()
      } catch (err) {
        console.error('Failed to reply:', err)
        alert('Failed to reply: ' + err.message)
      }
    }
  }

  const handleResolve = async (commentIndex) => {
    if (window.electronAPI && window.electronAPI.comment) {
      try {
        await window.electronAPI.comment.resolve(filePath, commentIndex)
        if (onResolve) onResolve()
      } catch (err) {
        console.error('Failed to resolve comment:', err)
        alert('Failed to resolve comment: ' + err.message)
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Add Comment Form */}
      <div className="bg-cursor-bg-primary rounded-lg p-4 border border-cursor-border shadow-sm">
        <h4 className="text-xs font-bold text-cursor-text-primary mb-3 uppercase tracking-wide">Add Comment</h4>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Line number (optional)"
              value={newComment.lineNumber || ''}
              onChange={(e) => setNewComment({ ...newComment, lineNumber: e.target.value ? parseInt(e.target.value) : null })}
              className="flex-1 bg-cursor-bg-secondary border border-cursor-border text-cursor-text-primary rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cursor-accent focus:border-cursor-accent transition-all"
            />
            <select
              value={newComment.type}
              onChange={(e) => setNewComment({ ...newComment, type: e.target.value })}
              className="bg-cursor-bg-secondary border border-cursor-border text-cursor-text-primary rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cursor-accent focus:border-cursor-accent transition-all"
            >
              <option value="suggestion">Suggestion</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="info">Info</option>
            </select>
          </div>
          <textarea
            value={newComment.content}
            onChange={(e) => setNewComment({ ...newComment, content: e.target.value })}
            placeholder="Enter your comment..."
            rows={3}
            className="w-full bg-cursor-bg-secondary border border-cursor-border text-cursor-text-primary rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cursor-accent focus:border-cursor-accent resize-none transition-all"
          />
          <button
            onClick={handleAddComment}
            className="w-full px-4 py-2 bg-cursor-accent text-white rounded-md hover:bg-cursor-accent-hover transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
          >
            Add Comment
          </button>
        </div>
      </div>

      {/* Comments List */}
      {comments && comments.length > 0 ? (
        <div className="space-y-3">
          {comments.map((comment, index) => {
            const getBorderColor = () => {
              if (comment.type === 'error') return 'border-red-500'
              if (comment.type === 'warning') return 'border-yellow-500'
              if (comment.type === 'info') return 'border-blue-500'
              return 'border-cursor-border'
            }
            
            return (
            <div
              key={index}
              className={`border-l-4 pl-4 py-3 rounded-r-lg transition-all duration-200 ${
                comment.resolved ? 'bg-cursor-bg-tertiary opacity-70' : 'bg-cursor-bg-primary'
              } ${getBorderColor()}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-cursor-text-primary">
                    {comment.lineNumber ? `Line ${comment.lineNumber}` : 'General Comment'}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                    comment.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    comment.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                    comment.type === 'info' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    'bg-cursor-bg-tertiary text-cursor-text-primary border border-cursor-border'
                  }`}>
                    {comment.type}
                  </span>
                  {comment.resolved && (
                    <span className="text-xs text-green-400 font-semibold flex items-center gap-1">
                      ✓ Resolved
                    </span>
                  )}
                </div>
                <span className="text-xs text-cursor-text-muted">
                  {new Date(comment.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-cursor-text-primary mb-3 leading-relaxed">{comment.content}</p>
              
              {/* Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ml-4 mt-3 space-y-2 border-l-2 border-cursor-border pl-4">
                  {comment.replies.map((reply, replyIndex) => (
                    <div key={replyIndex} className="text-sm text-cursor-text-secondary bg-cursor-bg-secondary rounded-md p-2">
                      <span className="text-xs text-cursor-text-muted mr-2">
                        {new Date(reply.createdAt).toLocaleDateString()}:
                      </span>
                      <span className="text-sm">{reply.content}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Reply Form */}
              {replyingTo === index && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Enter your reply..."
                    rows={2}
                    className="w-full bg-cursor-bg-secondary border border-cursor-border text-cursor-text-primary rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cursor-accent resize-none transition-all"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReply(index)}
                      className="px-3 py-1.5 bg-cursor-accent text-white rounded-md hover:bg-cursor-accent-hover transition-all duration-200 text-xs font-medium shadow-sm"
                    >
                      Reply
                    </button>
                    <button
                      onClick={() => {
                        setReplyingTo(null)
                        setReplyContent('')
                      }}
                      className="px-3 py-1.5 bg-cursor-bg-tertiary text-cursor-text-primary rounded-md hover:bg-cursor-hover transition-all duration-200 text-xs font-medium border border-cursor-border"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              {/* Actions */}
              {!comment.resolved && (
                <div className="flex gap-3 mt-3 pt-3 border-t border-cursor-border">
                  <button
                    onClick={() => setReplyingTo(index)}
                    className="text-xs text-cursor-accent hover:text-cursor-accent-hover transition-colors font-medium"
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => handleResolve(index)}
                    className="text-xs text-green-400 hover:text-green-300 transition-colors font-medium"
                  >
                    Resolve
                  </button>
                </div>
              )}
            </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center text-cursor-text-muted py-4">
          <p className="text-xs">No comments yet</p>
        </div>
      )}
    </div>
  )
}

