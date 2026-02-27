import Anthropic from '@anthropic-ai/sdk'
import type { CallClaudeOptions } from '@/types'
import type { ToolCallContext, ToolCallResult } from './tool-handlers'
import { executeToolCall } from './tool-handlers'
import { CHAT_TOOLS } from './tools'

// ── Modeles par defaut ─────────────────────────────────────────────────────

export const MODEL_CHAT = 'claude-haiku-4-5-20251001'
export const MODEL_SONNET = 'claude-sonnet-4-6'
// Sonnet est bien meilleur pour le tool use — on l'utilise pour le chat agentique
export const MODEL_CHAT_TOOLS = MODEL_SONNET

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

// ── Appel Claude avec outils (boucle agentique) ──────────────────────────
// Boucle non-streaming interne : appelle Claude, exécute les outils si
// demandé, renvoie le résultat à Claude, et recommence jusqu'à une réponse
// finale textuelle (ou max tours atteint).
//
// Callbacks SSE pour informer le client en temps réel des tool calls.

const MAX_TOOL_TURNS = 5

export interface ToolCallEvent {
  toolCallId: string
  toolName: string
}

export interface ToolResultEvent extends ToolCallEvent {
  result: ToolCallResult
}

export interface CallClaudeWithToolsOptions {
  systemPrompt: string
  messages: Anthropic.MessageParam[]
  model?: string
  maxTokens?: number
  toolContext: ToolCallContext
  onToolCallStart?: (event: ToolCallEvent) => void
  onToolCallResult?: (event: ToolResultEvent) => void
}

export interface CallClaudeWithToolsResult {
  text: string
  toolCalls: Array<{
    id: string
    name: string
    summary: string
  }>
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export async function callClaudeWithTools(
  options: CallClaudeWithToolsOptions
): Promise<CallClaudeWithToolsResult> {
  const client = getClient()
  const {
    systemPrompt,
    model = MODEL_CHAT_TOOLS,
    maxTokens = 4096,
    toolContext,
    onToolCallStart,
    onToolCallResult,
  } = options

  let messages: Anthropic.MessageParam[] = [...options.messages]
  const toolCallsSummary: CallClaudeWithToolsResult['toolCalls'] = []
  let totalUsage = { input_tokens: 0, output_tokens: 0 }

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
      tools: CHAT_TOOLS,
    })

    totalUsage.input_tokens += response.usage.input_tokens
    totalUsage.output_tokens += response.usage.output_tokens

    // Si stop_reason n'est pas tool_use, on a la réponse finale
    if (response.stop_reason !== 'tool_use') {
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      )
      const finalText = textBlocks.map((b) => b.text).join('')

      return {
        text: finalText,
        toolCalls: toolCallsSummary,
        usage: totalUsage,
      }
    }

    // Il y a des tool_use blocks — on les exécute
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    )

    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const toolUse of toolUseBlocks) {
      // Notifier le client du début de l'appel outil
      onToolCallStart?.({
        toolCallId: toolUse.id,
        toolName: toolUse.name,
      })

      // Exécuter l'outil
      const result = await executeToolCall(
        toolUse.name,
        toolUse.input as Record<string, unknown>,
        toolContext
      )

      // Notifier le client du résultat
      onToolCallResult?.({
        toolCallId: toolUse.id,
        toolName: toolUse.name,
        result,
      })

      toolCallsSummary.push({
        id: toolUse.id,
        name: toolUse.name,
        summary: result.summary,
      })

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify({
          success: result.success,
          summary: result.summary,
          data: result.data,
        }),
      })
    }

    // Ajouter la réponse de Claude (avec tool_use) et les résultats au contexte
    messages = [
      ...messages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults },
    ]
  }

  // Max tours atteint — retourner ce qu'on a
  return {
    text: 'J\'ai atteint le nombre maximum d\'actions pour cette requête. Voici ce que j\'ai fait.',
    toolCalls: toolCallsSummary,
    usage: totalUsage,
  }
}
