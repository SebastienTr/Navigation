import Anthropic from '@anthropic-ai/sdk'
import type { CallClaudeOptions } from '@/types'

// ── Modeles par defaut ─────────────────────────────────────────────────────

export const MODEL_CHAT = 'claude-haiku-4-5-20251001'
export const MODEL_SONNET = 'claude-sonnet-4-5-20241022'

// ── Client singleton ───────────────────────────────────────────────────────

let clientInstance: Anthropic | null = null

function getClient(): Anthropic {
  if (!clientInstance) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY manquant dans les variables d\'environnement'
      )
    }
    clientInstance = new Anthropic({ apiKey })
  }
  return clientInstance
}

// ── Appel Claude (non-streaming) ───────────────────────────────────────────

export async function callClaude(options: CallClaudeOptions): Promise<string> {
  const client = getClient()
  const {
    systemPrompt,
    messages,
    model = MODEL_CHAT,
    maxTokens = 4096,
  } = options

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  })

  // Extraire le texte de la reponse
  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  )

  if (textBlocks.length === 0) {
    throw new Error('Claude n\'a retourne aucun contenu textuel')
  }

  return textBlocks.map((block) => block.text).join('')
}

// ── Appel Claude (streaming) ───────────────────────────────────────────────
// Retourne un ReadableStream compatible avec les API Routes Next.js
// pour du Server-Sent Events (SSE) streaming.

export function streamClaude(options: CallClaudeOptions): ReadableStream<Uint8Array> {
  const client = getClient()
  const {
    systemPrompt,
    messages,
    model = MODEL_CHAT,
    maxTokens = 4096,
  } = options

  const encoder = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        })

        // Ecouter les deltas de texte
        stream.on('text', (text) => {
          // Format SSE : chaque chunk est un event "data:"
          const sseEvent = `data: ${JSON.stringify({ type: 'text_delta', text })}\n\n`
          controller.enqueue(encoder.encode(sseEvent))
        })

        // Attendre la fin du stream
        const finalMessage = await stream.finalMessage()

        // Envoyer l'evenement de fin avec les stats d'usage
        const doneEvent = `data: ${JSON.stringify({
          type: 'message_stop',
          usage: finalMessage.usage,
        })}\n\n`
        controller.enqueue(encoder.encode(doneEvent))

        controller.close()
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Erreur inconnue lors de l\'appel Claude'

        // Envoyer l'erreur en tant qu'evenement SSE avant de fermer
        const errorEvent = `data: ${JSON.stringify({
          type: 'error',
          error: errorMessage,
        })}\n\n`
        controller.enqueue(encoder.encode(errorEvent))
        controller.close()
      }
    },
  })
}
