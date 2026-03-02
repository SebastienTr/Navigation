'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { PHASES } from './MapView'

export default function MapLegend() {
  const [open, setOpen] = useState(false)

  return (
    <div className="absolute bottom-6 left-4 z-[1000]">
      <div className="rounded-lg bg-white/90 shadow-md backdrop-blur dark:bg-gray-800/90">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200"
        >
          <span>Phases</span>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>

        {open && (
          <div className="border-t border-gray-200/50 px-3 pb-2.5 pt-1.5 dark:border-gray-700/50">
            <ul className="space-y-1">
              {PHASES.map(p => (
                <li key={p.key} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <span
                    className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ background: p.color }}
                  />
                  {p.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
