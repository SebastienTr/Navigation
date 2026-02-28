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
      className={`rounded-lg border border-gray-200/60 p-4 dark:border-gray-800/40 ${
        hasCustomBg ? '' : 'bg-white dark:bg-gray-900'
      } ${
        onClick
          ? 'cursor-pointer transition-colors active:bg-gray-50 dark:active:bg-gray-800'
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
