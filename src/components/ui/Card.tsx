'use client'

import type { ReactNode, MouseEventHandler } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: MouseEventHandler<HTMLDivElement>
}

export function Card({ children, className = '', onClick }: CardProps) {
  const hasCustomBg = /\bbg-/.test(className)
  return (
    <div
      className={`rounded-xl border border-gray-200/60 p-4 shadow-[var(--shadow-md)] transition-all duration-200 dark:border-gray-700/30 ${
        hasCustomBg ? '' : 'bg-white dark:bg-gray-900/80'
      } ${
        onClick
          ? 'cursor-pointer hover:shadow-[var(--shadow-lg)] hover:border-gray-300/60 dark:hover:border-gray-600/40 active:scale-[0.99] active:bg-gray-50 dark:active:bg-gray-800'
          : ''
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
