import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamClaude } from '@/lib/ai/proxy'
import type { AIMessage } from '@/types'

interface ProxyRequestBody {
  messages: AIMessage[]
  systemPrompt: string
  model?: string
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
    const body = (await request.json()) as ProxyRequestBody

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: 'Le champ "messages" est requis et doit être un tableau non vide.' },
        { status: 400 }
      )
    }

    if (!body.systemPrompt || typeof body.systemPrompt !== 'string') {
      return NextResponse.json(
        { error: 'Le champ "systemPrompt" est requis.' },
        { status: 400 }
      )
    }

    // Validate message format
    for (const msg of body.messages) {
      if (msg.role !== 'user' && msg.role !== 'assistant') {
        return NextResponse.json(
          { error: `Rôle de message invalide : "${msg.role}". Utilisez "user" ou "assistant".` },
          { status: 400 }
        )
      }
      if (!msg.content || typeof msg.content !== 'string') {
        return NextResponse.json(
          { error: 'Chaque message doit avoir un contenu textuel.' },
          { status: 400 }
        )
      }
    }

    // Stream the Claude response
    const stream = streamClaude({
      messages: body.messages,
      systemPrompt: body.systemPrompt,
      model: body.model,
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('AI proxy error:', error)

    const message =
      error instanceof Error ? error.message : 'Erreur interne du serveur'

    return NextResponse.json(
      { error: `Erreur du proxy AI : ${message}` },
      { status: 500 }
    )
  }
}
