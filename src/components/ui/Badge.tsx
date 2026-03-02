interface BadgeProps {
  label: string
  variant: 'go' | 'standby' | 'nogo' | 'info' | 'muted'
  size?: 'sm' | 'md'
  className?: string
}

const variantClasses: Record<BadgeProps['variant'], string> = {
  go: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  standby: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  nogo: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  muted: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const sizeClasses: Record<NonNullable<BadgeProps['size']>, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
}

export function Badge({ label, variant, size = 'sm', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {label}
    </span>
  )
}
