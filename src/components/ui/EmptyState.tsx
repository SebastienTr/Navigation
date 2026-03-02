'use client'

import type { ReactNode } from 'react'

// ── SVG Illustrations ────────────────────────────────────────────────────────

function SailboatIllustration() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      className="empty-state-rock"
      aria-hidden="true"
    >
      {/* Water */}
      <path
        d="M8 62c6-3 12 0 18-3s12 0 18-3 12 0 18-3 12 0 18-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.15"
      />
      <path
        d="M4 68c6-2 12 1 18-2s12 1 18-2 12 1 18-2 12 1 18-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.1"
      />
      {/* Hull */}
      <path
        d="M22 56h36l-4 8H26l-4-8z"
        fill="currentColor"
        opacity="0.12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeOpacity="0.25"
      />
      {/* Mast */}
      <line x1="40" y1="16" x2="40" y2="56" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      {/* Main sail */}
      <path
        d="M40 18l16 34H40V18z"
        fill="currentColor"
        opacity="0.08"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeOpacity="0.2"
      />
      {/* Jib */}
      <path
        d="M40 22l-10 28H40V22z"
        fill="currentColor"
        opacity="0.06"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeOpacity="0.15"
      />
      {/* Flag */}
      <path
        d="M40 16l-6-4v3l6 1z"
        fill="#3B82F6"
        opacity="0.5"
      />
    </svg>
  )
}

function CompassIllustration() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      className="empty-state-spin"
      aria-hidden="true"
    >
      {/* Outer ring */}
      <circle cx="40" cy="40" r="30" stroke="currentColor" strokeWidth="2" opacity="0.15" />
      <circle cx="40" cy="40" r="26" stroke="currentColor" strokeWidth="1" opacity="0.1" />
      {/* Cardinal ticks */}
      <line x1="40" y1="10" x2="40" y2="16" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <line x1="40" y1="64" x2="40" y2="70" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <line x1="10" y1="40" x2="16" y2="40" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <line x1="64" y1="40" x2="70" y2="40" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      {/* N label */}
      <text x="40" y="23" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" opacity="0.3">N</text>
      {/* Compass needle - north (red) */}
      <path d="M40 26l-4 14h8l-4-14z" fill="#EF4444" opacity="0.5" />
      {/* Compass needle - south */}
      <path d="M40 54l-4-14h8l-4 14z" fill="currentColor" opacity="0.15" />
      {/* Center dot */}
      <circle cx="40" cy="40" r="3" fill="currentColor" opacity="0.2" />
    </svg>
  )
}

function AnchorIllustration() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      className="empty-state-sway"
      aria-hidden="true"
    >
      {/* Chain dots */}
      <circle cx="40" cy="18" r="1.5" fill="currentColor" opacity="0.15" />
      <circle cx="40" cy="13" r="1.5" fill="currentColor" opacity="0.1" />
      {/* Ring */}
      <circle cx="40" cy="24" r="5" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      {/* Shank */}
      <line x1="40" y1="29" x2="40" y2="60" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
      {/* Cross bar */}
      <line x1="28" y1="40" x2="52" y2="40" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      {/* Left fluke */}
      <path
        d="M28 40c0 10 12 16 12 20"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.2"
        fill="none"
      />
      {/* Right fluke */}
      <path
        d="M52 40c0 10-12 16-12 20"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.2"
        fill="none"
      />
      {/* Left fluke tip */}
      <path d="M25 42l3-2v4l-3-2z" fill="currentColor" opacity="0.2" />
      {/* Right fluke tip */}
      <path d="M55 42l-3-2v4l3-2z" fill="currentColor" opacity="0.2" />
    </svg>
  )
}

// ── Illustration map ─────────────────────────────────────────────────────────

const illustrations = {
  sailboat: SailboatIllustration,
  compass: CompassIllustration,
  anchor: AnchorIllustration,
} as const

export type EmptyStateIllustration = keyof typeof illustrations

// ── EmptyState component ─────────────────────────────────────────────────────

interface EmptyStateProps {
  illustration: EmptyStateIllustration
  title: string
  message: string
  children?: ReactNode
  compact?: boolean
}

export function EmptyState({ illustration, title, message, children, compact }: EmptyStateProps) {
  const Illustration = illustrations[illustration]

  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-center ${compact ? 'py-8' : 'min-h-[60dvh] px-6'}`}>
      <div className="text-gray-400 dark:text-gray-500">
        <Illustration />
      </div>
      <p className={`font-semibold text-gray-900 dark:text-gray-100 ${compact ? 'text-base' : 'text-lg'}`}>
        {title}
      </p>
      <p className="max-w-[280px] text-sm leading-relaxed text-gray-500 dark:text-gray-400">
        {message}
      </p>
      {children}
    </div>
  )
}
