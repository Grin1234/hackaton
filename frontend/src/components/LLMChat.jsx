import { useState, useEffect, useRef } from 'react'

export default function LLMChat({ filePath, codeContent, language, findings = [] }) {
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load chat history when component mounts
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!filePath || !window.electronAPI || !window.electronAPI.chat) return

      try {
        const result = await window.electronAPI.chat.getHistory(filePath)
        if (result.success && result.history && result.history.length > 0) {
          // Convert history to message format
          const loadedMessages = result.history.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp || msg.createdAt)
          }))
          setMessages(loadedMessages)
        }
      } catch (err) {
        console.error('Failed to load chat history:', err)
      }
    }

    loadChatHistory()
  }, [filePath])

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage = inputMessage.trim()
    setInputMessage('')
    setIsLoading(true)

    // Add user message to chat
    const newUserMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newUserMessage])

    try {
      if (!window.electronAPI || !window.electronAPI.chat) {
        throw new Error('Chat API not available')
      }

      const response = await window.electronAPI.chat.sendMessage(filePath, userMessage)
      
      if (response.success && response.reply) {
        const aiMessage = {
          role: 'assistant',
          content: response.reply,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, aiMessage])
      } else {
        throw new Error(response.error || 'Failed to get reply')
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      const errorMessage = {
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to get response from AI'}`,
        timestamp: new Date(),
        error: true
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full bg-cursor-bg-secondary border border-cursor-border">
      {/* Chat Header */}
      <div className="p-2 border-b border-cursor-border bg-cursor-bg-tertiary">
        <h3 className="text-xs font-normal text-cursor-text-secondary uppercase tracking-wider">
          Chat with AI Assistant
        </h3>
        <p className="text-xs text-cursor-text-muted mt-0.5">
          Ask questions about the code review or discuss findings
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: '400px' }}>
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-cursor-text-muted mb-2">Start a conversation with the AI assistant</p>
            <p className="text-xs text-cursor-text-muted">
              Ask about findings, request explanations, or discuss code improvements
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-md p-2.5 ${
                  message.role === 'user'
                    ? 'bg-cursor-accent text-white'
                    : message.error
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-cursor-bg-primary text-cursor-text-primary border border-cursor-border'
                }`}
              >
                <div className="text-xs mb-1 opacity-70">
                  {message.role === 'user' ? 'You' : '🤖 AI Assistant'}
                </div>
                <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
                <div className="text-xs mt-1 opacity-50">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-cursor-bg-primary text-cursor-text-primary border border-cursor-border rounded-md p-2.5">
              <div className="text-xs mb-1 opacity-70">🤖 AI Assistant</div>
              <div className="text-sm text-cursor-text-muted">Thinking...</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-2 border-t border-cursor-border bg-cursor-bg-tertiary">
        <div className="flex gap-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
            rows={2}
            disabled={isLoading}
            className="flex-1 bg-cursor-bg-primary border border-cursor-border text-cursor-text-primary rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cursor-accent resize-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="px-4 py-2 bg-cursor-accent text-white rounded-md hover:bg-cursor-accent-hover disabled:bg-cursor-bg-tertiary disabled:text-cursor-text-muted transition-all duration-200 text-sm font-medium shadow-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

