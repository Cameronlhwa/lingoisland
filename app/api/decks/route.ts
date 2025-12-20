import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/decks
 * List all decks for the authenticated user (include folder info)
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: decks, error } = await supabase
      .from('decks')
      .select(`
        *,
        folder:folders(id, name)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching decks:', error)
      return NextResponse.json(
        { error: 'Failed to fetch decks' },
        { status: 500 }
      )
    }

    return NextResponse.json({ decks: decks || [] })
  } catch (error) {
    console.error('Error in GET /api/decks:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/decks
 * Create a new deck
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, folderId } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Deck name is required' },
        { status: 400 }
      )
    }

    // Validate folder belongs to user if provided
    if (folderId) {
      const { data: folder } = await supabase
        .from('folders')
        .select('id')
        .eq('id', folderId)
        .eq('user_id', user.id)
        .single()

      if (!folder) {
        return NextResponse.json(
          { error: 'Folder not found or access denied' },
          { status: 404 }
        )
      }
    }

    const { data: deck, error } = await supabase
      .from('decks')
      .insert({
        user_id: user.id,
        folder_id: folderId || null,
        name: name.trim(),
      })
      .select(`
        *,
        folder:folders(id, name)
      `)
      .single()

    if (error) {
      // Check if it's a unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A deck with this name already exists in this folder' },
          { status: 409 }
        )
      }
      console.error('Error creating deck:', error)
      return NextResponse.json(
        { error: 'Failed to create deck' },
        { status: 500 }
      )
    }

    return NextResponse.json({ deck })
  } catch (error) {
    console.error('Error in POST /api/decks:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

