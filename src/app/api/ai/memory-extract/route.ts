import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { callClaude, MODEL_CHAT } from '@/lib/ai/proxy'
import { getVoyageMemory } from '@/lib/supabase/queries'
import type { Database } from '@/lib/supabase/types'

type ChatHistoryRow = Database['public']['Tables']['chat_history']['Row']
type AiMemoryRow = Database['public']['Tables']['ai_memory']['Row']

const MEMORY_SLUGS = ['situation', 'boat', 'crew', 'preferences'] as const
type MemorySlug = (typeof MEMORY_SLUGS)[number]

// ── Extraction prompt ─────────────────────────────────────────────────────

function buildExtractionPrompt(
  chatMessages: ChatHistoryRow[],
  currentMemory: Record<MemorySlug, string>
): string {
  const chatText = chatMessages
    .map((m) => `[${m.role}] ${m.content}`)
    .join('\n\n')

  return `Tu es le système de mémoire de Bosco, un second de bord IA pour voiliers.

Tu dois analyser les conversations récentes et mettre à jour les documents de mémoire si nécessaire.

## DOCUMENTS DE MÉMOIRE ACTUELS

### situation (où est le capitaine, le bateau, plans à venir)
${currentMemory.situation || '(vide)'}

### boat (observations bateau, problèmes, réparations, particularités)
${currentMemory.boat || '(vide)'}

### crew (équipage, santé, moral, compétences)
${currentMemory.crew || '(vide)'}

### preferences (préférences du capitaine)
${currentMemory.preferences || '(vide)'}

## CONVERSATIONS DES 48 DERNIÈRES HEURES

${chatText || '(aucune conversation)'}

## INSTRUCTIONS

Analyse les conversations ci-dessus et détermine si les documents de mémoire doivent être mis à jour.

Règles:
- Ne modifie un document QUE s'il y a des informations nouvelles ou modifiées dans les conversations
- Si un document est déjà à jour, ne le modifie pas
- Quand tu modifies un document, RÉÉCRIS-LE ENTIÈREMENT (pas juste l'ajout) — il doit être complet et cohérent
- Inclus les dates quand c'est pertinent (ex: "Départ prévu le 7 mars 2026")
- Sois concis — chaque document doit tenir en quelques lignes
- Écris en français

Réponds UNIQUEMENT avec un JSON valide:
{
  "updates": {
    "situation": "nouveau contenu ou null si pas de changement",
    "boat": "nouveau contenu ou null si pas de changement",
    "crew": "nouveau contenu ou null si pas de changement",
    "preferences": "nouveau contenu ou null si pas de changement"
  },
  "reasoning": "explication courte de ce que tu as changé et pourquoi"
}

Si aucun document n'a besoin d'être mis à jour, retourne:
{
  "updates": { "situation": null, "boat": null, "crew": null, "preferences": null },
  "reasoning": "Aucune info nouvelle dans les conversations récentes"
}`
}

// ── GET — Cron job: extract memory from chat for all active voyages ───────

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET non configuré.' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Non autorisé.' },
        { status: 401 }
      )
    }

    const adminSupabase = createAdminClient()

    // Query all active voyages
    const { data: activeVoyages, error: voyagesError } = await adminSupabase
      .from('voyages')
      .select('id, user_id, name')
      .eq('status', 'active')

    if (voyagesError) {
      throw new Error(`Failed to query active voyages: ${voyagesError.message}`)
    }

    if (!activeVoyages || activeVoyages.length === 0) {
      return NextResponse.json({
        message: 'Aucun voyage actif.',
        processed: 0,
      })
    }

    const results: Array<{
      userId: string
      voyageId: string
      voyageName: string
      updated: string[]
      success: boolean
      error?: string
    }> = []

    // Process each voyage
    for (const voyage of activeVoyages) {
      try {
        // Fetch last 48h of chat history
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
        const { data: chatMessages } = await adminSupabase
          .from('chat_history')
          .select('*')
          .eq('voyage_id', voyage.id)
          .gte('created_at', cutoff)
          .order('created_at', { ascending: true })
          .returns<ChatHistoryRow[]>()

        if (!chatMessages || chatMessages.length === 0) {
          results.push({
            userId: voyage.user_id,
            voyageId: voyage.id,
            voyageName: voyage.name,
            updated: [],
            success: true,
          })
          continue
        }

        // Fetch current memory docs
        const memoryRows = await getVoyageMemory(adminSupabase, voyage.id)
        const currentMemory: Record<MemorySlug, string> = {
          situation: '',
          boat: '',
          crew: '',
          preferences: '',
        }
        const memoryMap: Record<string, AiMemoryRow> = {}
        for (const row of memoryRows) {
          if (row.slug in currentMemory) {
            currentMemory[row.slug as MemorySlug] = row.content
            memoryMap[row.slug] = row
          }
        }

        // Call Claude Haiku to extract
        const prompt = buildExtractionPrompt(chatMessages, currentMemory)
        const response = await callClaude({
          systemPrompt: prompt,
          messages: [{ role: 'user', content: 'Analyse les conversations et mets à jour la mémoire.' }],
          model: MODEL_CHAT,
          maxTokens: 2048,
        })

        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error('Claude n\'a pas retourné de JSON valide')
        }

        const parsed = JSON.parse(jsonMatch[0]) as {
          updates: Record<MemorySlug, string | null>
          reasoning: string
        }

        const updatedSlugs: string[] = []

        // Apply updates
        for (const slug of MEMORY_SLUGS) {
          const newContent = parsed.updates[slug]
          if (newContent == null || newContent === currentMemory[slug]) continue

          const existing = memoryMap[slug]
          if (existing) {
            const newVersion = existing.version + 1

            // Save version
            await adminSupabase.from('ai_memory_versions').insert({
              memory_id: existing.id,
              content: newContent,
              version: newVersion,
              updated_by: 'cron',
            })

            // Prune old versions (keep last 5)
            const { data: versions } = await adminSupabase
              .from('ai_memory_versions')
              .select('id')
              .eq('memory_id', existing.id)
              .order('version', { ascending: false })
              .range(5, 100)

            if (versions && versions.length > 0) {
              await adminSupabase
                .from('ai_memory_versions')
                .delete()
                .in('id', versions.map((v) => v.id))
            }

            // Update main doc
            await adminSupabase
              .from('ai_memory')
              .update({
                content: newContent,
                version: newVersion,
                updated_at: new Date().toISOString(),
                updated_by: 'cron' as const,
              })
              .eq('id', existing.id)
          } else {
            // Create new doc
            const { data: inserted } = await adminSupabase
              .from('ai_memory')
              .insert({
                user_id: voyage.user_id,
                voyage_id: voyage.id,
                slug,
                content: newContent,
                version: 1,
                updated_by: 'cron' as const,
              })
              .select('id')
              .single()

            if (inserted) {
              await adminSupabase.from('ai_memory_versions').insert({
                memory_id: inserted.id,
                content: newContent,
                version: 1,
                updated_by: 'cron',
              })
            }
          }

          updatedSlugs.push(slug)
        }

        results.push({
          userId: voyage.user_id,
          voyageId: voyage.id,
          voyageName: voyage.name,
          updated: updatedSlugs,
          success: true,
        })

        console.log(
          `Memory extract [${voyage.name}]: ${updatedSlugs.length > 0 ? updatedSlugs.join(', ') : 'no updates'}. Reason: ${parsed.reasoning}`
        )
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Erreur inconnue'
        console.error(`Memory extract failed for voyage ${voyage.id}:`, errMsg)
        results.push({
          userId: voyage.user_id,
          voyageId: voyage.id,
          voyageName: voyage.name,
          updated: [],
          success: false,
          error: errMsg,
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const updatedCount = results.filter((r) => r.updated.length > 0).length

    return NextResponse.json({
      message: `Memory extraction: ${successCount}/${activeVoyages.length} voyages traités, ${updatedCount} mis à jour`,
      processed: successCount,
      updated: updatedCount,
      total: activeVoyages.length,
      results,
    })
  } catch (error) {
    console.error('Memory extraction cron error:', error)
    const message = error instanceof Error ? error.message : 'Erreur interne'
    return NextResponse.json(
      { error: `Erreur cron memory-extract: ${message}` },
      { status: 500 }
    )
  }
}
