'use client'

import type { ReactNode, MouseEventHandler } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  onClick?: MouseEventHandler<HTMLDivElement>
  animate?: boolean
}

export function GlassCard({ children, className = '', onClick, animate = true }: GlassCardProps) {
  return (
    <div
      className={`glass rounded-xl shadow-[var(--shadow-lg)] p-4 transition-all duration-200 ${
        animate ? 'animate-[fadeIn_0.3s_ease-out]' : ''
      } ${
        onClick ? 'cursor-pointer hover:shadow-[var(--shadow-lg)] active:scale-[0.99]' : ''
      } ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick(e as unknown as React.MouseEvent<HTMLDivElement>)
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}
