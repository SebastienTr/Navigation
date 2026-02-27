'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Send, MessageCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useActiveVoyage } from '@/lib/auth/hooks'
import { createClient } from '@/lib/supabase/client'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { Database } from '@/lib/supabase/types'

type ChatMessageRow = Database['public']['Tables']['chat_history']['Row']

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

const SUGGESTION_CHIPS = [
  'Briefing du jour',
  'État carburant',
  'Prochaine étape',
  'Météo actuelle',
] as const

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="flex max-w-[80%] items-center gap-1 rounded-2xl rounded-bl-sm bg-gray-200 px-4 py-3 dark:bg-gray-800">
        <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-500 dark:bg-gray-400 [animation-delay:0ms]" />
        <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-500 dark:bg-gray-400 [animation-delay:150ms]" />
        <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-500 dark:bg-gray-400 [animation-delay:300ms]" />
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { user } = useAuth()
  const { voyage, loading: voyageLoading } = useActiveVoyage()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isStreaming, scrollToBottom])

  // Load chat history
  useEffect(() => {
    if (!user || !voyage) {
      setIsLoadingHistory(false)
      return
    }

    const loadHistory = async () => {
      setIsLoadingHistory(true)
      const supabase = createClient()

      const { data, error: fetchError } = await supabase
        .from('chat_history')
        .select('*')
        .eq('voyage_id', voyage.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .returns<ChatMessageRow[]>()

      if (fetchError) {
        console.error('Failed to load chat history:', fetchError.message)
        setError('Impossible de charger l\u2019historique du chat.')
      } else if (data) {
        setMessages(
          data.map((row: ChatMessageRow) => ({
            id: row.id,
            role: row.role,
            content: row.content,
            createdAt: row.created_at,
          }))
        )
      }
      setIsLoadingHistory(false)
    }

    loadHistory()
  }, [user, voyage])

  // Send message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || !voyage) return

      const trimmedText = text.trim()
      setInput('')
      setError(null)

      // Add user message to list immediately
      const userMessage: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        role: 'user',
        content: trimmedText,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMessage])

      // Prepare assistant placeholder
      const assistantMessageId = `temp-assistant-${Date.now()}`
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      }

      setIsStreaming(true)

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmedText,
            voyageId: voyage.id,
          }),
        })

        if (!response.ok) {
          throw new Error(`Erreur serveur (${response.status})`)
        }

        if (!response.body) {
          throw new Error('Pas de flux de r\u00e9ponse')
        }

        // Add empty assistant message
        setMessages((prev) => [...prev, assistantMessage])

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          accumulated += chunk

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: accumulated }
                : msg
            )
          )
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Une erreur est survenue. R\u00e9essayez.'
        setError(errorMessage)

        // Remove the empty assistant message if it was added
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantMessageId || msg.content !== '')
        )
      } finally {
        setIsStreaming(false)
      }
    },
    [isStreaming, voyage]
  )

  // Handle keyboard input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }

  // Loading state
  if (voyageLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner text="Chargement..." />
      </div>
    )
  }

  // No active voyage
  if (!voyage) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <MessageCircle size={48} className="text-gray-300 dark:text-gray-700" />
        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Aucun voyage actif
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Cr\u00e9ez un voyage dans les r\u00e9glages pour commencer \u00e0 discuter.
        </p>
      </div>
    )
  }

  const showSuggestions = messages.length === 0 && !isLoadingHistory

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Chat
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Votre second IA \u2014 {voyage.name}
        </p>
      </header>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {isLoadingHistory ? (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner text="Chargement des messages..." size="sm" />
          </div>
        ) : (
          <>
            {/* Suggestion chips when no messages */}
            {showSuggestions && (
              <div className="flex flex-col items-center justify-center gap-6 py-12">
                <div className="text-center">
                  <MessageCircle
                    size={40}
                    className="mx-auto mb-3 text-blue-500 dark:text-blue-400"
                  />
                  <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                    Posez une question
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Votre second conna\u00eet votre bateau et votre itin\u00e9raire
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTION_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => sendMessage(chip)}
                      disabled={isStreaming}
                      className="min-h-[44px] rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors active:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:active:bg-blue-900"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message bubbles */}
            <div className="flex flex-col gap-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'rounded-br-sm bg-blue-600 text-white'
                        : 'rounded-bl-sm bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                      {msg.content}
                    </p>
                    <p
                      className={`mt-1 text-[10px] ${
                        msg.role === 'user'
                          ? 'text-blue-200'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isStreaming &&
                messages.length > 0 &&
                messages[messages.length - 1].content === '' && (
                  <TypingIndicator />
                )}
            </div>

            {/* Error message */}
            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Parlez \u00e0 votre second..."
            disabled={isStreaming}
            rows={1}
            className="min-h-[44px] flex-1 resize-none rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-[15px] text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={isStreaming || !input.trim()}
            aria-label="Envoyer"
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors active:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
