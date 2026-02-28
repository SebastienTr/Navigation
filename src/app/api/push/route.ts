import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── POST — Subscribe to push notifications ─────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié.' },
        { status: 401 }
      )
    }

    const { subscription } = await request.json()

    if (!subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json(
        { error: 'Subscription invalide.' },
        { status: 400 }
      )
    }

    // Upsert: if endpoint already exists, update keys
    const { error: upsertError } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        { onConflict: 'endpoint' }
      )

    if (upsertError) {
      console.error('Push subscription save failed:', upsertError)
      return NextResponse.json(
        { error: 'Erreur lors de la sauvegarde.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Push subscribe error:', error)
    return NextResponse.json(
      { error: 'Erreur interne.' },
      { status: 500 }
    )
  }
}

// ── DELETE — Unsubscribe from push notifications ────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié.' },
        { status: 401 }
      )
    }

    const { endpoint } = await request.json()

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint requis.' },
        { status: 400 }
      )
    }

    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Push unsubscribe error:', error)
    return NextResponse.json(
      { error: 'Erreur interne.' },
      { status: 500 }
    )
  }
}
