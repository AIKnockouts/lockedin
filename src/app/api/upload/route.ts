import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { community_id, image_url, habit_description, date } = body

  if (!community_id || !image_url || !habit_description || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const serviceClient = createSupabaseServiceClient()

  // Check for existing submission today
  const { data: existing } = await serviceClient
    .from('daily_submissions')
    .select('id')
    .eq('community_id', community_id)
    .eq('user_id', user.id)
    .eq('date', date)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Already submitted today' }, { status: 409 })
  }

  // Check if user is a member
  const { data: member } = await serviceClient
    .from('community_members')
    .select('id, forfeited')
    .eq('community_id', community_id)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'Not a member of this community' }, { status: 403 })
  }
  if (member.forfeited) {
    return NextResponse.json({ error: 'You have forfeited from this community' }, { status: 403 })
  }

  // Call Claude Vision
  let ai_result = 'UNCERTAIN'
  let confidence = 0.5
  let final_status = 'FAILURE'

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'url', url: image_url },
            },
            {
              type: 'text',
              text: `The user claims they completed this habit:

"Habit: ${habit_description}"

Does this image clearly show that they completed it today?

Respond ONLY in JSON with no other text:
{"result": "YES" | "NO" | "UNCERTAIN", "confidence": <number between 0 and 1>}`,
            },
          ],
        },
      ],
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        ai_result = parsed.result || 'UNCERTAIN'
        confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
      }
    }
  } catch (err) {
    console.error('Claude API error:', err)
    // Continue with defaults
  }

  if (ai_result === 'YES' && confidence > 0.7) {
    final_status = 'SUCCESS'
  }

  // Insert submission
  const { data: submission, error: insertError } = await serviceClient
    .from('daily_submissions')
    .insert({
      community_id,
      user_id: user.id,
      date,
      image_url,
      ai_result,
      confidence,
      final_status,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Update member streak and failure count
  const { data: currentMember } = await serviceClient
    .from('community_members')
    .select('total_failures, current_streak, longest_streak, max_failures_allowed')
    .eq('community_id', community_id)
    .eq('user_id', user.id)
    .single()

  const { data: community } = await serviceClient
    .from('communities')
    .select('max_failures')
    .eq('id', community_id)
    .single()

  if (currentMember && community) {
    let newStreak = currentMember.current_streak
    let newFailures = currentMember.total_failures
    let forfeited = false

    if (final_status === 'SUCCESS') {
      newStreak += 1
    } else {
      newStreak = 0
      newFailures += 1
      if (newFailures > community.max_failures) {
        forfeited = true
      }
    }

    await serviceClient
      .from('community_members')
      .update({
        current_streak: newStreak,
        longest_streak: Math.max(newStreak, currentMember.longest_streak),
        total_failures: newFailures,
        forfeited,
      })
      .eq('community_id', community_id)
      .eq('user_id', user.id)
  }

  return NextResponse.json({
    id: submission.id,
    ai_result,
    confidence,
    final_status,
  })
}
