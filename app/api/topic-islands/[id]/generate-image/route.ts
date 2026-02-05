import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateIslandImage } from '@/lib/nanobanana/generate-island-image'

/**
 * POST /api/topic-islands/[id]/generate-image
 * Generate a themed island image using the base island art.
 * 
 * NOTE: Generation disabled for cost savings in normal product flow.
 * All islands now use pre-generated library images (cover_key).
 * This route is kept for legacy support and manual generation if needed.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const islandId = params.id
    const { data: island, error: islandError } = await supabase
      .from('topic_islands')
      .select('id, topic, image_url')
      .eq('id', islandId)
      .eq('user_id', user.id)
      .single()

    if (islandError) {
      console.error('Error loading island for image generation:', islandError)
      const message =
        islandError.message?.includes('image_url')
          ? 'image_url column missing. Run the latest migration.'
          : islandError.message || 'Island query failed'
      return NextResponse.json({ error: message }, { status: 500 })
    }

    if (!island) {
      return NextResponse.json(
        { error: 'Island not found or access denied' },
        { status: 404 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const force = Boolean(body?.force)

    if (island.image_url && !force) {
      return NextResponse.json({ status: 'exists' })
    }

    const generated = await generateIslandImage({ 
      topic: island.topic,
      removeBackgroundEnabled: true 
    })
    const imageUrl = `data:${generated.mimeType};base64,${generated.data}`

    const { error: updateError } = await supabase
      .from('topic_islands')
      .update({ image_url: imageUrl })
      .eq('id', islandId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating island image:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Failed to save island image' },
        { status: 500 }
      )
    }

    return NextResponse.json({ status: 'ready' })
  } catch (error) {
    console.error('Error in POST /api/topic-islands/[id]/generate-image:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message, details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
