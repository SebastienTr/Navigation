'use client'

import { useEffect, useCallback, useState } from 'react'

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    setIsSupported(supported)

    if (supported) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub)
        })
      })
    }
  }, [])

  const subscribe = useCallback(async () => {
    if (!isSupported) return false

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return false

      const registration = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      if (!vapidKey) {
        console.warn('VAPID public key not configured')
        return false
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      })

      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
              auth: arrayBufferToBase64(subscription.getKey('auth')!),
            },
          },
        }),
      })

      if (res.ok) {
        setIsSubscribed(true)
        return true
      }
      return false
    } catch (error) {
      console.error('Push subscription failed:', error)
      return false
    }
  }, [isSupported])

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await fetch('/api/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
      setIsSubscribed(false)
    } catch (error) {
      console.error('Push unsubscribe failed:', error)
    }
  }, [isSupported])

  return { isSubscribed, isSupported, subscribe, unsubscribe }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
