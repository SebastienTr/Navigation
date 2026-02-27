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
      setError('Une erreur est survenue. Veuillez r\u00e9essayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-950">
      {/* Branding */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-20 h-20 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center mb-4 shadow-lg shadow-blue-600/20">
          <Anchor className="w-10 h-10 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          Laurine Navigator
        </h1>
        <p className="text-base text-slate-500 dark:text-slate-400 mt-1">
          Votre premier second
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm">
        {sent ? (
          /* Success state */
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              V\u00e9rifiez votre bo\u00eete mail
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Un lien de connexion a \u00e9t\u00e9 envoy\u00e9 \u00e0{' '}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {email}
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                setSent(false)
                setEmail('')
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline min-h-[44px] flex items-center justify-center mx-auto"
            >
              Utiliser une autre adresse
            </button>
          </div>
        ) : (
          /* Login form */
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-700"
          >
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-1 text-center">
              Connexion
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center">
              Recevez un lien magique par email
            </p>

            {/* Email input */}
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Adresse email
            </label>
            <div className="relative mb-4">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="capitaine@example.com"
                required
                autoComplete="email"
                className="w-full h-[52px] pl-12 pr-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4 text-center">
                {error}
              </p>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full h-[52px] rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 dark:disabled:bg-blue-800 text-white font-semibold text-base transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                'Envoyer le lien magique'
              )}
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-slate-400 dark:text-slate-500 text-center">
        Connexion s\u00e9curis\u00e9e par Supabase Auth
      </p>
    </div>
  )
}
