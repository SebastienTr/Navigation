'use client'

import { useState } from 'react'
import { Anchor, Mail, Loader2, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (authError) {
        setError(authError.message)
      } else {
        setSent(true)
      }
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-gradient-to-b from-gray-100 to-gray-50 dark:from-gray-950 dark:to-gray-900">
      {/* Branding */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-18 h-18 rounded-2xl bg-blue-600 dark:bg-blue-500 flex items-center justify-center mb-4 shadow-lg shadow-blue-600/20">
          <Anchor className="w-9 h-9 text-white" strokeWidth={2} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          Bosco
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Votre premier second
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm">
        {sent ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-7 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
            <div className="w-14 h-14 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Vérifiez votre boîte mail
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Un lien de connexion a été envoyé à{' '}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {email}
              </span>
            </p>
            <button
              type="button"
              onClick={() => { setSent(false); setEmail('') }}
              className="text-sm text-blue-600 dark:text-blue-400 min-h-[44px] flex items-center justify-center mx-auto"
            >
              Utiliser une autre adresse
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-gray-800 rounded-2xl p-7 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 text-center">
              Connexion
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
              Recevez un lien magique par email
            </p>

            <label
              htmlFor="email"
              className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
            >
              Adresse email
            </label>
            <div className="relative mb-4">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="capitaine@example.com"
                required
                autoComplete="email"
                className="w-full h-12 pl-11 pr-4 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:border-gray-600 dark:bg-gray-700/50 dark:text-white dark:placeholder:text-gray-500 dark:focus:ring-blue-400"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4 text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full h-12 rounded-lg bg-blue-600 active:bg-blue-700 disabled:bg-blue-400 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 dark:bg-blue-500 dark:active:bg-blue-600 dark:disabled:bg-blue-800"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                'Envoyer le lien magique'
              )}
            </button>
          </form>
        )}
      </div>

      <p className="mt-8 text-xs text-gray-400 dark:text-gray-600 text-center">
        Connexion sécurisée par Supabase Auth
      </p>
    </div>
  )
}
