import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildChatContext } from '@/lib/ai/context'
import { buildChatSystemPrompt } from '@/lib/ai/prompts'
import { streamClaude, MODEL_CHAT } from '@/lib/ai/proxy'
import { getVoyageChatHistory } from '@/lib/supabase/queries'
import type { AIMessage } from '@/types'

interface ChatRequestBody {
  message: string
  voyageId: string
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user via Supabase session
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié. Veuillez vous connecter.' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = (await request.json()) as ChatRequestBody

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        { error: 'Le champ "message" est requis.' },
        { status: 400 }
      )
    }

    if (!body.voyageId || typeof body.voyageId !== 'string') {
      return NextResponse.json(
        { error: 'Le champ "voyageId" est requis.' },
        { status: 400 }
      )
    }

    // Verify user owns this voyage
    const { data: voyage, error: voyageError } = await supabase
      .from('voyages')
      .select('id')
      .eq('id', body.voyageId)
      .eq('user_id', user.id)
      .returns<{ id: string }[]>()
      .single()

    if (voyageError || !voyage) {
      return NextResponse.json(
        { error: 'Voyage introuvable ou non autorisé.' },
        { status: 404 }
      )
    }

    // Build chat context (includes boat, weather, tides, route, etc.)
    const chatContext = await buildChatContext(supabase, user.id, body.voyageId)
    const systemPrompt = buildChatSystemPrompt(chatContext)

    // Get recent chat history for conversation continuity
    const recentHistory = await getVoyageChatHistory(
      supabase,
      body.voyageId,
      20
    )

    // Build messages array with history + new message
    const messages: AIMessage[] = recentHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))
    messages.push({ role: 'user', content: body.message })

    // Save the user message to chat_history
    const { error: insertUserError } = await supabase
      .from('chat_history')
      .insert({
        user_id: user.id,
        voyage_id: body.voyageId,
        role: 'user' as const,
        content: body.message,
        context_snapshot: {
          position: chatContext.boatStatus?.current_position ?? null,
          weather: chatContext.weather ? 'available' : 'unavailable',
          date: chatContext.date,
        },
      })

    if (insertUserError) {
      console.error('Failed to save user message:', insertUserError)
    }

    // Stream Claude response, collect it, and save to DB
    const stream = streamClaude({
      messages,
      systemPrompt,
      model: MODEL_CHAT,
      maxTokens: 2048,
    })

    // We need to tee the stream: one branch for the client, one to collect for DB save
    const [clientStream, collectStream] = stream.tee()

    // Collect the full response in the background and save to DB
    const savePromise = (async () => {
      const reader = collectStream.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[DONE]') && !line.includes('"type":"message_stop"') && !line.includes('"type":"error"')) {
            try {
              const parsed = JSON.parse(line.slice(6)) as {
                type?: string
                text?: string
              }
              if (parsed.text) {
                fullText += parsed.text
              }
            } catch {
              // Skip malformed lines
            }
          }
        }
      }

      // Save assistant response
      if (fullText.length > 0) {
        const { error: insertAssistantError } = await supabase
          .from('chat_history')
          .insert({
            user_id: user.id,
            voyage_id: body.voyageId,
            role: 'assistant' as const,
            content: fullText,
          })

        if (insertAssistantError) {
          console.error(
            'Failed to save assistant message:',
            insertAssistantError
          )
        }
      }
    })()

    // Don't await the save — let it complete in the background
    // Use waitUntil if available (Vercel), otherwise fire-and-forget
    savePromise.catch((err) =>
      console.error('Error saving chat history:', err)
    )

    return new Response(clientStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)

    const message =
      error instanceof Error ? error.message : 'Erreur interne du serveur'

    return NextResponse.json(
      { error: `Erreur du chat : ${message}` },
      { status: 500 }
    )
  }
}
