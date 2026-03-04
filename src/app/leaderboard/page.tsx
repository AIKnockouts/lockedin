'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface LeaderboardEntry {
  user_id: string
  display_name: string
  avatar_url: string
  total_streak: number
  total_success: number
  total_failures: number
  communities_count: number
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLeaderboard() {
      const { data } = await supabase
        .from('community_members')
        .select('user_id, current_streak, total_failures, forfeited, profiles(display_name, avatar_url)')
        .eq('forfeited', false)
        .order('current_streak', { ascending: false })
        .limit(50)

      if (data) {
        // Aggregate by user
        const map = new Map<string, LeaderboardEntry>()
        data.forEach((m: any) => {
          const existing = map.get(m.user_id)
          if (existing) {
            existing.total_streak += m.current_streak
            existing.total_failures += m.total_failures
            existing.communities_count += 1
          } else {
            map.set(m.user_id, {
              user_id: m.user_id,
              display_name: m.profiles?.display_name || 'Anonymous',
              avatar_url: m.profiles?.avatar_url || '',
              total_streak: m.current_streak,
              total_success: 0,
              total_failures: m.total_failures,
              communities_count: 1,
            })
          }
        })
        setEntries(Array.from(map.values()).sort((a, b) => b.total_streak - a.total_streak))
      }
      setLoading(false)
    }
    fetchLeaderboard()
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Link href="/" className="text-xl font-bold text-indigo-400">LockedIn</Link>
        <div className="flex gap-4">
          <Link href="/dashboard" className="text-zinc-400 hover:text-white text-sm">Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-2">Wall of Discipline 🏆</h1>
          <p className="text-zinc-400">The most dedicated members across all communities.</p>
        </div>

        {loading ? (
          <div className="text-center text-zinc-500">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-center text-zinc-500 py-12">No data yet. Be the first to submit!</div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, idx) => (
              <div key={entry.user_id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
                <div className={`w-8 h-8 flex items-center justify-center font-bold text-sm rounded-full ${idx === 0 ? 'bg-yellow-500 text-black' : idx === 1 ? 'bg-zinc-400 text-black' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                  {idx + 1}
                </div>
                {entry.avatar_url ? (
                  <img src={entry.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-800 flex items-center justify-center text-sm font-bold">
                    {entry.display_name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold">{entry.display_name}</p>
                  <p className="text-xs text-zinc-500">{entry.communities_count} communit{entry.communities_count === 1 ? 'y' : 'ies'}</p>
                </div>
                <div className="text-right">
                  <p className="text-indigo-400 font-bold">🔥 {entry.total_streak}</p>
                  <p className="text-xs text-zinc-500">streak days</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
