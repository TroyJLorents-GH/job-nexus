import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, Plus, Trash2, Code, MessageSquare } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { apiFetch } from '../services/api'
import { useAuth } from '../context/AuthProvider'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatSession {
  id: string
  title: string
  messages: Message[]
  timestamp: string
}

const MODELS = [
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'PersonalAssistant', label: 'Personal Assistant' },
] as const

export function Chat() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState('gpt-5')
  const [mode, setMode] = useState<'general' | 'code'>('general')
  const [loading, setLoading] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px'
    }
  }, [input])

  const startNewChat = () => {
    // Save current chat to history
    if (messages.length > 0) {
      const title = messages[0].content.slice(0, 40) + (messages[0].content.length > 40 ? '...' : '')
      const session: ChatSession = {
        id: currentChatId || crypto.randomUUID(),
        title,
        messages: [...messages],
        timestamp: new Date().toISOString(),
      }
      setChatHistory((prev) => {
        const filtered = prev.filter((c) => c.id !== session.id)
        return [session, ...filtered].slice(0, 20) // Keep last 20
      })
    }
    setMessages([])
    setCurrentChatId(crypto.randomUUID())
    setInput('')
  }

  const loadChat = (session: ChatSession) => {
    // Save current first
    if (messages.length > 0 && currentChatId) {
      const title = messages[0].content.slice(0, 40) + (messages[0].content.length > 40 ? '...' : '')
      setChatHistory((prev) => {
        const updated = prev.filter((c) => c.id !== currentChatId)
        return [{ id: currentChatId, title, messages: [...messages], timestamp: new Date().toISOString() }, ...updated]
      })
    }
    setMessages(session.messages)
    setCurrentChatId(session.id)
    setSidebarOpen(false)
  }

  const deleteChat = (id: string) => {
    setChatHistory((prev) => prev.filter((c) => c.id !== id))
    if (currentChatId === id) {
      setMessages([])
      setCurrentChatId(crypto.randomUUID())
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Build history for context (exclude current message)
    const history = messages.map((m) => ({ role: m.role, content: m.content }))

    try {
      const isFoundry = model === 'PersonalAssistant'

      if (isFoundry) {
        // Non-streaming: Foundry returns full JSON response
        const res = await apiFetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, model, mode, history }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Chat request failed')
        setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])
      } else {
        // Streaming: OpenAI via SSE
        const res = await apiFetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, model, mode, history }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Chat request failed')
        }

        const contentType = res.headers.get('content-type') || ''

        if (contentType.includes('text/event-stream')) {
          // SSE streaming response
          const reader = res.body!.getReader()
          const decoder = new TextDecoder()
          let assistantContent = ''

          // Add empty assistant message to fill via streaming
          setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

          let buffer = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') break
                try {
                  const parsed = JSON.parse(data)
                  if (parsed.content) {
                    assistantContent += parsed.content
                    setMessages((prev) => {
                      const updated = [...prev]
                      updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
                      return updated
                    })
                  }
                  if (parsed.error) {
                    throw new Error(parsed.error)
                  }
                } catch (e) {
                  // Skip malformed JSON
                  if (e instanceof Error && e.message !== 'Skip') throw e
                }
              }
            }
          }
        } else {
          // JSON fallback (e.g., moderation flagged)
          const data = await res.json()
          setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Something went wrong'
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${errorMsg}` }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-lg shadow-sm border overflow-hidden">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } absolute md:relative z-10 w-64 h-full bg-gray-50 border-r flex flex-col transition-transform`}
      >
        <div className="p-3 border-b">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chatHistory.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No chat history</p>
          ) : (
            chatHistory.map((session) => (
              <div
                key={session.id}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm ${
                  currentChatId === session.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => loadChat(session)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate flex-1">{session.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteChat(session.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header bar with controls */}
        <div className="flex items-center gap-3 px-4 py-2 border-b bg-gray-50">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden text-gray-500 hover:text-gray-700"
          >
            <MessageSquare className="h-5 w-5" />
          </button>

          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="text-sm border rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setMode(mode === 'general' ? 'code' : 'general')}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border ${
              mode === 'code'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            <Code className="h-4 w-4" />
            {mode === 'code' ? 'Code' : 'General'}
          </button>

          <span className="ml-auto text-xs text-gray-400 hidden sm:inline">
            {user?.displayName || user?.email}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
              <Bot className="h-12 w-12" />
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="text-sm">Choose a model and ask anything.</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-blue-600" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-code:text-pink-600 prose-code:before:content-none prose-code:after:content-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content || '...'}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
              )}
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Bot className="h-4 w-4 text-blue-600" />
              </div>
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t px-4 py-3 bg-white">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${MODELS.find((m) => m.value === model)?.label ?? model}...`}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 max-h-36"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="shrink-0 p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
