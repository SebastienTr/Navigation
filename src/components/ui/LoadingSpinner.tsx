'use client'

interface LoadingSpinnerProps {
  text?: string
  size?: 'sm' | 'md' | 'lg'
}

export function LoadingSpinner({ text, size = 'md' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-gray-300 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400`}
      />
      {text && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{text}</p>
      )}
    </div>
  )
}
