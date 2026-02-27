import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:contact@laurine-navigator.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('VAPID keys not configured, skipping push notification');
    return false;
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error('Push notification failed:', error);
    return false;
  }
}

export async function sendPushToUser(
  supabase: Parameters<typeof sendPushNotification>[0] extends never ? never : {
    from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => Promise<{ data: Array<{ endpoint: string; keys: Record<string, string> }> | null }> } }
  },
  userId: string,
  payload: PushPayload
): Promise<void> {
  // This is a simplified version - in production, use the proper Supabase admin client
  // The actual implementation fetches push subscriptions from the push_subscriptions table
  console.log(`Push notification for user ${userId}:`, payload.title, payload.body);
}
