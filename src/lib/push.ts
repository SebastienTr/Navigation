// ── Push Notifications ────────────────────────────────────────────────────
// Envoie des notifications Web Push aux abonnés d'un utilisateur.
// Utilise le client admin Supabase pour accéder aux subscriptions.

import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type AdminClient = SupabaseClient<Database>

interface PushPayload {
  title: string
  body: string
  tag?: string
  url?: string
}

function configureVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!publicKey || !privateKey) return false

  webpush.setVapidDetails(
    'mailto:contact@bosco-nav.com',
    publicKey,
    privateKey
  )
  return true
}

/**
 * Envoie une notification push à tous les devices d'un utilisateur.
 * Nettoie les subscriptions invalides (410 Gone).
 */
export async function sendPushToUser(
  supabase: AdminClient,
  userId: string,
  payload: PushPayload
): Promise<number> {
  if (!configureVapid()) {
    console.warn('VAPID keys not configured — push skipped')
    return 0
  }

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, keys')
    .eq('user_id', userId)

  if (error || !subscriptions || subscriptions.length === 0) {
    return 0
  }

  let sent = 0

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string },
        },
        JSON.stringify(payload)
      )
      sent++
    } catch (pushError) {
      // Supprimer les subscriptions expirées (410 Gone)
      if (
        pushError instanceof webpush.WebPushError &&
        pushError.statusCode === 410
      ) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('id', sub.id)
      } else {
        console.error(`Push failed for ${sub.endpoint}:`, pushError)
      }
    }
  }

  return sent
}
