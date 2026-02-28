import { NextRequest, NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildChatContext } from '@/lib/ai/context'
import { buildChatSystemPrompt } from '@/lib/ai/prompts'
import {
  callClaudeWithTools,
  MODEL_CHAT_TOOLS,
  type CallClaudeWithToolsResult,
} from '@/lib/ai/proxy'
import { getVoyageChatHistory } from '@/lib/supabase/queries'

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
    // On reconstruit les messages Anthropic avec le bon format
    const messages: Anthropic.MessageParam[] = recentHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
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

    // Admin client pour les tool handlers (bypass RLS, auth vérifiée ci-dessus)
    const adminSupabase = createAdminClient()

    // Construire le ReadableStream SSE avec la boucle agentique
    const encoder = new TextEncoder()

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const result: CallClaudeWithToolsResult = await callClaudeWithTools({
            systemPrompt,
            messages,
            model: MODEL_CHAT_TOOLS,
            maxTokens: 4096,
            toolContext: {
              supabase: adminSupabase,
              userId: user.id,
              voyageId: body.voyageId,
            },
            onToolCallStart: (event) => {
              const sseEvent = `data: ${JSON.stringify({
                type: 'tool_call_start',
                tool_name: event.toolName,
                tool_call_id: event.toolCallId,
              })}\n\n`
              controller.enqueue(encoder.encode(sseEvent))
            },
            onToolCallResult: (event) => {
              const sseEvent = `data: ${JSON.stringify({
                type: 'tool_call_result',
                tool_call_id: event.toolCallId,
                tool_name: event.toolName,
                success: event.result.success,
                summary: event.result.summary,
              })}\n\n`
              controller.enqueue(encoder.encode(sseEvent))
            },
            onTextDelta: (text) => {
              const sseEvent = `data: ${JSON.stringify({
                type: 'text_delta',
                text,
              })}\n\n`
              controller.enqueue(encoder.encode(sseEvent))
            },
          })

          // Text was already streamed via onTextDelta

          // Envoyer l'événement de fin
          const doneEvent = `data: ${JSON.stringify({
            type: 'message_stop',
            usage: result.usage,
          })}\n\n`
          controller.enqueue(encoder.encode(doneEvent))

          controller.close()

          // Sauvegarder la réponse assistant en arrière-plan
          if (result.text || result.toolCalls.length > 0) {
            // Format du content : texte simple si pas de tool calls, JSON sinon
            let content: string
            if (result.toolCalls.length === 0) {
              content = result.text
            } else {
              content = JSON.stringify({
                text: result.text,
                tool_calls: result.toolCalls,
              })
            }

            const { error: insertAssistantError } = await supabase
              .from('chat_history')
              .insert({
                user_id: user.id,
                voyage_id: body.voyageId,
                role: 'assistant' as const,
                content,
              })

            if (insertAssistantError) {
              console.error(
                'Failed to save assistant message:',
                insertAssistantError
              )
            }
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Erreur inconnue lors de l\'appel Claude'

          const errorEvent = `data: ${JSON.stringify({
            type: 'error',
            error: errorMessage,
          })}\n\n`
          controller.enqueue(encoder.encode(errorEvent))
          controller.close()
        }
      },
    })

    return new Response(stream, {
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
