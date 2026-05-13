import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../services/api'
import MarkdownRenderer from './MarkdownRenderer'
import './ChatWidget.css'

export default function ChatWidget({ courseId }) {
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  // Inline rename state
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const bottomRef = useRef(null)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)
  const editInputRef = useRef(null)

  // Fetch all conversations for the logged-in user
  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true)
      const { data } = await api.get('/conversations')
      setConversations(data.conversations || [])
      // Auto-select the most recent conversation
      if (data.conversations?.length > 0 && !activeConversationId) {
        setActiveConversationId(data.conversations[0]._id)
      }
    } catch {
      // ignore
    } finally {
      setLoadingConversations(false)
    }
  }, [activeConversationId])

  // Load messages for the active conversation (or legacy courseId)
  const loadHistory = useCallback(async () => {
    const chatId = activeConversationId || courseId
    if (!chatId) return
    try {
      setLoadingHistory(true)
      const { data } = await api.get(`/chat/${chatId}`)
      setMessages(data.messages || [])
    } catch {
      setMessages([])
    } finally {
      setLoadingHistory(false)
    }
  }, [activeConversationId, courseId])

  useEffect(() => {
    loadConversations()
  }, [courseId])

  useEffect(() => {
    loadHistory()
  }, [activeConversationId, courseId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus input when maximized
  useEffect(() => {
    if (isMaximized) inputRef.current?.focus()
  }, [isMaximized])

  const createNewConversation = async () => {
    try {
      const { data } = await api.post('/conversations', {
        title: 'New Chat',
        courseId: courseId || null,
      })
      setConversations(prev => [data.conversation, ...prev])
      setActiveConversationId(data.conversation._id)
      setMessages([])
      setDropdownOpen(false)
    } catch {
      // ignore
    }
  }

  const deleteConversation = async (e, id) => {
    e.stopPropagation() // don't trigger selectConversation
    if (!window.confirm('Delete this chat and all its messages?')) return
    try {
      await api.delete(`/conversations/${id}`)
      setConversations(prev => prev.filter(c => c._id !== id))
      // If we deleted the active one, clear or pick the next available
      if (activeConversationId === id) {
        const remaining = conversations.filter(c => c._id !== id)
        setActiveConversationId(remaining[0]?._id || null)
        setMessages([])
      }
    } catch {
      // ignore
    }
  }

  const selectConversation = (id) => {
    if (editingId) return // don't switch while renaming
    setActiveConversationId(id)
    setDropdownOpen(false)
  }

  const startEditing = (e, conv) => {
    e.stopPropagation()
    setEditingId(conv._id)
    setEditTitle(conv.title)
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  const cancelEditing = (e) => {
    e?.stopPropagation()
    setEditingId(null)
    setEditTitle('')
  }

  const saveRename = async (e, id) => {
    e?.stopPropagation()
    const trimmed = editTitle.trim()
    if (!trimmed) { cancelEditing(); return }
    try {
      await api.put(`/conversations/${id}/title`, { title: trimmed })
      setConversations(prev => prev.map(c =>
        c._id === id ? { ...c, title: trimmed } : c
      ))
    } catch {
      // ignore
    } finally {
      setEditingId(null)
      setEditTitle('')
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { role: 'user', content: text, _id: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const payload = { message: text }
      if (activeConversationId) payload.conversationId = activeConversationId
      if (courseId) payload.courseId = courseId

      const { data } = await api.post('/chat', payload)

      const newMsgs = [{ role: 'assistant', content: data.answer, _id: Date.now() + 1 }]
      if (data.warning) {
        newMsgs.push({ role: 'assistant', content: data.warning, _id: Date.now() + 2 })
      }
      setMessages(prev => [...prev, ...newMsgs])

      // Update conversation title if it was the first message
      if (activeConversationId) {
        setConversations(prev => prev.map(c =>
          c._id === activeConversationId && c.title === 'New Chat'
            ? { ...c, title: text.substring(0, 45) }
            : c
        ))
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.response?.data?.error
          ? `❌ Error: ${err.response.data.error}`
          : '❌ Sorry, something went wrong. Please try again.',
        _id: Date.now() + 1
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(e)
    }
  }

  const activeConversation = conversations.find(c => c._id === activeConversationId)

  // ─── Shared Inner UI ────────────────────────────────────────────────────────
  const chatInner = (maximized = false) => (
    <div className={`chat-widget-inner ${maximized ? 'maximized' : ''}`}>

      {/* ── Header ── */}
      <div className="chat-header-bar">
        <div className="chat-header-left">
          <div className="chat-ai-icon">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </div>
          <div>
            <h2 className="chat-title-text">AI Study Buddy</h2>
            <div className="chat-online-badge">
              <span className="chat-online-dot" />
              <span>Online</span>
            </div>
          </div>
        </div>

        <div className="chat-header-right">
          {/* Conversation Dropdown */}
          <div className="chat-conv-dropdown" ref={maximized ? null : dropdownRef}>
            <button
              className="chat-conv-trigger"
              onClick={() => setDropdownOpen(o => !o)}
              title="Switch conversation"
            >
              <span className="chat-conv-trigger-label">
                {loadingConversations
                  ? '...'
                  : activeConversation
                    ? truncate(activeConversation.title, 20)
                    : 'Select Chat'}
              </span>
              <svg className={`chat-conv-chevron ${dropdownOpen ? 'open' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="chat-conv-menu">
                {/* New Chat */}
                <button className="chat-conv-new" onClick={createNewConversation}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-3.5 h-3.5">
                    <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                  </svg>
                  New Chat
                </button>

                {conversations.length > 0 && <div className="chat-conv-divider" />}

                {/* Existing Conversations */}
                <div className="chat-conv-list">
                  {conversations.map(conv => (
                    <div
                      key={conv._id}
                      className={`chat-conv-item ${conv._id === activeConversationId ? 'active' : ''} ${editingId === conv._id ? 'editing' : ''}`}
                      onClick={() => editingId !== conv._id && selectConversation(conv._id)}
                    >
                      {editingId === conv._id ? (
                        /* ── Inline rename input ── */
                        <>
                          <input
                            ref={editInputRef}
                            className="chat-conv-rename-input"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveRename(e, conv._id)
                              if (e.key === 'Escape') cancelEditing(e)
                            }}
                            onClick={e => e.stopPropagation()}
                          />
                          <span className="chat-conv-rename-actions">
                            <span
                              role="button"
                              className="chat-conv-rename-save"
                              title="Save"
                              onClick={(e) => saveRename(e, conv._id)}
                            >
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-3 h-3">
                                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                              </svg>
                            </span>
                            <span
                              role="button"
                              className="chat-conv-rename-cancel"
                              title="Cancel"
                              onClick={cancelEditing}
                            >
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-3 h-3">
                                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                              </svg>
                            </span>
                          </span>
                        </>
                      ) : (
                        /* ── Normal row ── */
                        <>
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0 opacity-50">
                            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                          </svg>
                          <span className="chat-conv-item-title">{truncate(conv.title, 18)}</span>
                          {conv._id === activeConversationId && <span className="chat-conv-active-dot" />}
                          {/* Pencil & Trash — reveal on hover */}
                          <span className="chat-conv-actions">
                            <span
                              className="chat-conv-action-btn"
                              role="button"
                              title="Rename"
                              onClick={(e) => startEditing(e, conv)}
                            >
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-3 h-3">
                                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                              </svg>
                            </span>
                            <span
                              className="chat-conv-action-btn delete"
                              role="button"
                              title="Delete"
                              onClick={(e) => deleteConversation(e, conv._id)}
                            >
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-3 h-3">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                              </svg>
                            </span>
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                  {conversations.length === 0 && !loadingConversations && (
                    <p className="chat-conv-empty">No chats yet</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Maximize / Restore Button */}
          <button
            className="chat-maximize-btn"
            onClick={() => setIsMaximized(o => !o)}
            title={isMaximized ? 'Restore' : 'Expand chat'}
          >
            {isMaximized ? (
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            ) : (
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
                <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="chat-messages-area">
        {loadingHistory ? (
          <div className="chat-state-center">
            <div className="chat-spinner" />
            <p className="chat-state-text">Loading history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-state-center">
            <div className="chat-empty-icon">💬</div>
            <p className="chat-empty-title">
              {activeConversation ? activeConversation.title : 'Ask anything about the course!'}
            </p>
            <p className="chat-empty-sub">I'm trained on your current lesson material.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg._id || i} className={`chat-msg ${msg.role}`}>
              <div className={`chat-msg-avatar ${msg.role}`}>
                <span>{msg.role === 'user' ? 'YOU' : 'AI'}</span>
              </div>
              <div className={`chat-msg-bubble ${msg.role}`}>
                <MarkdownRenderer content={msg.content} />
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="chat-msg assistant">
            <div className="chat-msg-avatar assistant">
              <span>AI</span>
            </div>
            <div className="chat-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="chat-input-bar">
        <form className="chat-input-form" onSubmit={sendMessage}>
          <input
            ref={inputRef}
            className="chat-input-field"
            placeholder={activeConversation ? `Message "${truncate(activeConversation.title, 20)}"...` : 'Ask anything about the lesson...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="chat-send-btn"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
              <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
            </svg>
          </button>
        </form>
        <span className="chat-powered-by">Powered by TL;DR</span>
      </div>
    </div>
  )

  return (
    <>
      {/* Inline widget (always visible in CoursePage col-right) */}
      <div className="chat-widget-wrap">
        {chatInner(false)}
      </div>

      {/* Maximized overlay */}
      {isMaximized && (
        <div className="chat-overlay-backdrop" onClick={() => setIsMaximized(false)}>
          <div className="chat-overlay-panel" onClick={e => e.stopPropagation()}>
            {chatInner(true)}
          </div>
        </div>
      )}
    </>
  )
}

function truncate(str, max) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}
