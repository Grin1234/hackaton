export default function CommentThread({ comment }) {
  return (
    <div className="border-l-4 border-cursor-border pl-4 py-2">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-medium text-cursor-text-primary">
          {comment.lineNumber ? `Line ${comment.lineNumber}` : 'General Comment'}
        </span>
        <span className={`text-xs px-2 py-1 rounded ${
          comment.type === 'error' ? 'bg-cursor-error bg-opacity-20 text-cursor-error border border-cursor-error' :
          comment.type === 'warning' ? 'bg-cursor-warning bg-opacity-20 text-cursor-warning border border-cursor-warning' :
          comment.type === 'info' ? 'bg-cursor-accent bg-opacity-20 text-cursor-accent border border-cursor-accent' :
          'bg-cursor-bg-tertiary text-cursor-text-primary border border-cursor-border'
        }`}>
          {comment.type}
        </span>
      </div>
      <p className="text-xs text-cursor-text-primary mb-2">{comment.content}</p>
      
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-4 mt-2 space-y-2 border-l-2 border-cursor-border pl-4">
          {comment.replies.map((reply, index) => (
            <div key={index} className="text-xs text-cursor-text-secondary">
              {reply.content}
            </div>
          ))}
        </div>
      )}
      
      {comment.resolved && (
        <span className="text-xs text-cursor-success font-medium">✓ Resolved</span>
      )}
    </div>
  )
}

