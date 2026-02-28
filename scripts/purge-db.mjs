import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load env vars from .env.local
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) env[match[1].trim()] = match[2].trim()
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Tables in deletion order (children first, respecting foreign keys)
const tables = [
  'boat_status',
  'chat_history',
  'briefings',
  'logs',
  'checklist',
  'route_steps',
  'reminders',
  'push_subscriptions',
  'voyages',
  'nav_profiles',
  'boats',
  'users',
]

async function purge() {
  console.log(`Purging database at ${supabaseUrl}...\n`)

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (error) {
      console.log(`  ${table}: ${error.message}`)
    } else {
      console.log(`  ${table}: purged`)
    }
  }

  // Delete auth users
  console.log('\nDeleting auth users...')
  const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers()

  if (listError) {
    console.error('  Error listing auth users:', listError.message)
  } else if (authUsers?.users?.length > 0) {
    for (const user of authUsers.users) {
      const { error: delError } = await supabase.auth.admin.deleteUser(user.id)
      if (delError) {
        console.log(`  Auth user ${user.email}: ${delError.message}`)
      } else {
        console.log(`  Auth user ${user.email}: deleted`)
      }
    }
  } else {
    console.log('  No auth users found')
  }

  console.log('\nDone! Database purged.')
}

purge().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
