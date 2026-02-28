import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildBriefingContext } from '@/lib/ai/context'
import { buildBriefingSystemPrompt } from '@/lib/ai/prompts'
import { callClaude, MODEL_SONNET } from '@/lib/ai/proxy'
import { getActiveVoyage } from '@/lib/supabase/queries'
import { sendPushToUser } from '@/lib/push'
import { log } from '@/lib/logger'
import type { Database } from '@/lib/supabase/types'
import type { Verdict, Confidence } from '@/types'

type BriefingRow = Database['public']['Tables']['briefings']['Row']

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Parse verdict and confidence from the AI briefing text.
 * Looks for patterns like "**GO**" or "VERDICT: GO" and "Confiance: haute"
 */
function parseVerdictFromContent(content: string): {
  verdict: Verdict | null
  confidence: Confidence | null
  wind: string | null
  sea: string | null
} {
  let verdict: Verdict | null = null
  let confidence: Confidence | null = null
  let wind: string | null = null
  let sea: string | null = null

  // Parse verdict
  const verdictMatch = content.match(
    /\*?\*?(GO|STANDBY|NO-GO)\*?\*?/i
  )
  if (verdictMatch) {
    const raw = verdictMatch[1].toUpperCase()
    if (raw === 'GO' || raw === 'STANDBY' || raw === 'NO-GO') {
      verdict = raw as Verdict
    }
  }

  // Parse confidence
  const confidenceMatch = content.match(
    /[Cc]onfiance\s*:?\s*\*?\*?(haute|high|moyenne|medium|basse|low)\*?\*?/i
  )
  if (confidenceMatch) {
    const raw = confidenceMatch[1].toLowerCase()
    if (raw === 'haute' || raw === 'high') confidence = 'high'
    else if (raw === 'moyenne' || raw === 'medium') confidence = 'medium'
    else if (raw === 'basse' || raw === 'low') confidence = 'low'
  }

  // Parse wind summary (first line mentioning vent/wind)
  const windMatch = content.match(
    /[Vv]ent\s*:?\s*(.+?)(?:\n|$)/
  )
  if (windMatch) {
    wind = windMatch[1].trim().slice(0, 200)
  }

  // Parse sea summary (first line mentioning mer/sea/houle/vagues)
  const seaMatch = content.match(
    /[Mm]er\s*:?\s*(.+?)(?:\n|$)/
  )
  if (seaMatch) {
    sea = seaMatch[1].trim().slice(0, 200)
  }

  return { verdict, confidence, wind, sea }
}

// ── POST — User-triggered briefing ────────────────────────────────────────

export async function POST(request: NextRequest) {
  const timer = log.timed('briefing', 'User briefing generation')
  try {
    // Authenticate user
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

    // Get active voyage
    const voyage = await getActiveVoyage(supabase, user.id)
    if (!voyage) {
      return NextResponse.json(
        { error: 'Aucun voyage actif trouvé.' },
        { status: 404 }
      )
    }

    // Build context and generate briefing
    const context = await buildBriefingContext(supabase, user.id, voyage.id)
    const systemPrompt = buildBriefingSystemPrompt(context)

    const content = await callClaude({
      messages: [
        {
          role: 'user',
          content: `Génère le briefing du ${context.date} pour la position actuelle.`,
        },
      ],
      systemPrompt,
      model: MODEL_SONNET,
      maxTokens: 4096,
    })

    // Parse verdict and metadata from response
    const { verdict, confidence, wind, sea } = parseVerdictFromContent(content)

    // Save briefing to database
    const { data: briefing, error: insertError } = await supabase
      .from('briefings')
      .insert({
        user_id: user.id,
        voyage_id: voyage.id,
        date: context.date,
        position: context.boatStatus?.current_position ?? 'Position inconnue',
        destination: context.currentStep?.to_port ?? null,
        verdict,
        confidence,
        wind,
        sea,
        content,
        weather_data: context.weather as unknown as Record<string, unknown> ?? null,
        tide_data: context.tides as unknown as Record<string, unknown> ?? null,
      } as Database['public']['Tables']['briefings']['Insert'])
      .select()
      .returns<BriefingRow[]>()
      .single()

    if (insertError) {
      log.error('briefing', 'Failed to save briefing', { error: insertError.message, voyageId: voyage.id })
      // Still return the briefing even if save failed
      return NextResponse.json({
        content,
        verdict,
        confidence,
        wind,
        sea,
        date: context.date,
        saved: false,
      })
    }

    timer.end({ verdict: briefing.verdict, voyageId: voyage.id })

    return NextResponse.json({
      id: briefing.id,
      content: briefing.content,
      verdict: briefing.verdict,
      confidence: briefing.confidence,
      wind: briefing.wind,
      sea: briefing.sea,
      date: briefing.date,
      saved: true,
    })
  } catch (error) {
    timer.error(error)

    const message =
      error instanceof Error ? error.message : 'Erreur interne du serveur'

    return NextResponse.json(
      { error: `Erreur lors de la génération du briefing : ${message}` },
      { status: 500 }
    )
  }
}

// ── GET — Cron job: generate briefings for all active voyages ─────────────

export async function GET(request: NextRequest) {
  const cronTimer = log.timed('briefing', 'Cron briefing batch')
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

    // Use admin client to bypass RLS and access all users' data
    const adminSupabase = createAdminClient()

    // Query all users with active voyages
    const { data: activeVoyages, error: voyagesError } = await adminSupabase
      .from('voyages')
      .select('id, user_id, boat_id, nav_profile_id, name')
      .eq('status', 'active')

    if (voyagesError) {
      throw new Error(`Failed to query active voyages: ${voyagesError.message}`)
    }

    if (!activeVoyages || activeVoyages.length === 0) {
      return NextResponse.json({
        message: 'Aucun voyage actif trouvé.',
        generated: 0,
      })
    }

    const results: Array<{
      userId: string
      voyageId: string
      voyageName: string
      verdict: Verdict | null
      success: boolean
      error?: string
    }> = []

    // Generate briefings for each active voyage
    for (const voyage of activeVoyages) {
      try {
        const context = await buildBriefingContext(
          adminSupabase,
          voyage.user_id,
          voyage.id
        )
        const systemPrompt = buildBriefingSystemPrompt(context)

        const content = await callClaude({
          messages: [
            {
              role: 'user',
              content: `Génère le briefing du ${context.date} pour la position actuelle.`,
            },
          ],
          systemPrompt,
          model: MODEL_SONNET,
          maxTokens: 4096,
        })

        const { verdict, confidence, wind, sea } =
          parseVerdictFromContent(content)

        const { error: insertError } = await adminSupabase
          .from('briefings')
          .insert({
            user_id: voyage.user_id,
            voyage_id: voyage.id,
            date: context.date,
            position:
              context.boatStatus?.current_position ?? 'Position inconnue',
            destination: context.currentStep?.to_port ?? null,
            verdict,
            confidence,
            wind,
            sea,
            content,
            weather_data: context.weather as unknown as Record<string, unknown> ?? null,
            tide_data: context.tides as unknown as Record<string, unknown> ?? null,
          } as Database['public']['Tables']['briefings']['Insert'])

        if (insertError) {
          throw new Error(`DB insert failed: ${insertError.message}`)
        }

        // Envoyer push notification
        await sendPushToUser(adminSupabase, voyage.user_id, {
          title: verdict
            ? `Briefing: ${verdict}`
            : 'Votre briefing est prêt',
          body: verdict
            ? `Verdict du jour: ${verdict}${confidence ? ` (confiance ${confidence})` : ''}`
            : 'Consultez votre briefing du matin',
          tag: `briefing-${context.date}`,
          url: '/briefings',
        }).catch((err) =>
          console.error(`Push failed for user ${voyage.user_id}:`, err)
        )

        results.push({
          userId: voyage.user_id,
          voyageId: voyage.id,
          voyageName: voyage.name,
          verdict,
          success: true,
        })
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : 'Erreur inconnue'
        console.error(
          `Briefing failed for voyage ${voyage.id} (user ${voyage.user_id}):`,
          errMsg
        )
        results.push({
          userId: voyage.user_id,
          voyageId: voyage.id,
          voyageName: voyage.name,
          verdict: null,
          success: false,
          error: errMsg,
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    cronTimer.end({ generated: successCount, total: activeVoyages.length })

    return NextResponse.json({
      message: `Briefings générés : ${successCount}/${activeVoyages.length}`,
      generated: successCount,
      total: activeVoyages.length,
      results,
    })
  } catch (error) {
    cronTimer.error(error)

    const message =
      error instanceof Error ? error.message : 'Erreur interne du serveur'

    return NextResponse.json(
      { error: `Erreur cron briefing : ${message}` },
      { status: 500 }
    )
  }
}
