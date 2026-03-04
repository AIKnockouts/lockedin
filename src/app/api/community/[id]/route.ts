import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createSupabaseServiceClient()

  const [commRes, membersRes, subsRes] = await Promise.all([
    serviceClient.from('communities').select('*').eq('id', id).single(),
    serviceClient.from('community_members').select('*, profiles(display_name, avatar_url)').eq('community_id', id),
    serviceClient.from('daily_submissions').select('*, profiles(display_name, avatar_url)').eq('community_id', id).order('created_at', { ascending: false }).limit(30),
  ])

  if (commRes.error) {
    return NextResponse.json({ error: 'Community not found' }, { status: 404 })
  }

  // Check membership for private communities
  if (commRes.data.visibility === 'private') {
    const isMember = membersRes.data?.some((m: any) => m.user_id === user.id)
    if (!isMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
  }

  return NextResponse.json({
    community: commRes.data,
    members: membersRes.data || [],
    submissions: subsRes.data || [],
  })
}
