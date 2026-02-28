// ── Structured Logger ─────────────────────────────────────────────────────
// JSON logs for easy AI/machine parsing on Vercel.
// Usage: log.info('ai', 'Route generated', { model, duration })

type Level = 'debug' | 'info' | 'warn' | 'error'

type Tag = 'ai' | 'weather' | 'auth' | 'db' | 'push' | 'trigger' | 'route' | 'briefing' | 'chat' | 'onboarding'

interface LogEntry {
  level: Level
  tag: Tag
  msg: string
  ts: string
  duration_ms?: number
  [key: string]: unknown
}

function emit(level: Level, tag: Tag, msg: string, data?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    tag,
    msg,
    ts: new Date().toISOString(),
    ...data,
  }

  const json = JSON.stringify(entry)

  switch (level) {
    case 'error':
      console.error(json)
      break
    case 'warn':
      console.warn(json)
      break
    default:
      console.log(json)
  }
}

/** Start a timer, returns a function that logs completion with duration */
function timed(tag: Tag, msg: string, data?: Record<string, unknown>) {
  const start = Date.now()
  return {
    end(extra?: Record<string, unknown>) {
      emit('info', tag, msg, { ...data, ...extra, duration_ms: Date.now() - start })
    },
    error(err: unknown, extra?: Record<string, unknown>) {
      const errMsg = err instanceof Error ? err.message : String(err)
      emit('error', tag, msg, { ...data, ...extra, error: errMsg, duration_ms: Date.now() - start })
    },
  }
}

export const log = {
  debug: (tag: Tag, msg: string, data?: Record<string, unknown>) => emit('debug', tag, msg, data),
  info: (tag: Tag, msg: string, data?: Record<string, unknown>) => emit('info', tag, msg, data),
  warn: (tag: Tag, msg: string, data?: Record<string, unknown>) => emit('warn', tag, msg, data),
  error: (tag: Tag, msg: string, data?: Record<string, unknown>) => emit('error', tag, msg, data),
  timed,
}
