import type { SupabaseClient } from '@supabase/supabase-js'

export async function uploadLogPhotos(
  supabase: SupabaseClient,
  userId: string,
  voyageId: string,
  files: File[]
): Promise<string[]> {
  const urls: string[] = []

  for (const file of files) {
    const ext = file.name.split('.').pop() ?? 'jpg'
    const timestamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    const path = `${userId}/${voyageId}/${timestamp}-${rand}.${ext}`

    const { error } = await supabase.storage
      .from('log-photos')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('Photo upload failed:', error.message)
      continue
    }

    const { data: urlData } = supabase.storage
      .from('log-photos')
      .getPublicUrl(path)

    urls.push(urlData.publicUrl)
  }

  return urls
}
