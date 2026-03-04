'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface Community {
  id: string
  name: string
  habit_description: string
  stake_amount: number
  duration_days: number
  start_date: string
  visibility: string
  community_members: { total_failures: number; current_streak: number; forfeited: boolean }[]
}

interface Profile {
  display_name: string
  avatar_url: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [communities, setCommunities] = useState<Community[]>([])
  const [publicCommunities, setPublicCommunities] = useState<Community[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    name: '', habit_description: '', stake_amount: 5, duration_days: 30,
    max_failures: 1, visibility: 'public', submission_start: '05:00', submission_end: '23:00',
    start_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUser(user)
      fetchData(user.id)
    })
  }, [])

  async function fetchData(userId: string) {
    const [profileRes, memberRes, publicRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('community_members').select('community_id, total_failures, current_streak, forfeited, communities(*)').eq('user_id', userId),
      supabase.from('communities').select('*, community_members(total_failures, current_streak, forfeited)').eq('visibility', 'public').limit(6),
    ])

    setProfile(profileRes.data)

    if (memberRes.data) {
      const joined = memberRes.data.map((m: any) => ({
        ...m.communities,
        community_members: [{ total_failures: m.total_failures, current_streak: m.current_streak, forfeited: m.forfeited }],
      }))
      setCommunities(joined)
    }

    if (publicRes.data) setPublicCommunities(publicRes.data)
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const { data, error } = await supabase.from('communities').insert({
      ...form,
      created_by: user.id,
    }).select().single()

    if (!error && data) {
      await supabase.from('community_members').insert({
        community_id: data.id,
        user_id: user.id,
        stake_paid: true,
      })
      setShowCreate(false)
      fetchData(user.id)
    }
  }

  async function handleJoin(communityId: string) {
    if (!user) return
    const { error } = await supabase.from('community_members').insert({
      community_id: communityId,
      user_id: user.id,
      stake_paid: true,
    })
    if (!error) fetchData(user.id)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-400">Loading…</div>

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Link href="/" className="text-xl font-bold text-indigo-400">LockedIn</Link>
        <div className="flex items-center gap-4">
          <Link href="/leaderboard" className="text-zinc-400 hover:text-white text-sm">Leaderboard</Link>
          <Link href="/settings" className="text-zinc-400 hover:text-white text-sm">Settings</Link>
          <button onClick={handleLogout} className="text-zinc-500 hover:text-white text-sm">Logout</button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {profile?.display_name || user?.email}</h1>
            <p className="text-zinc-500 text-sm mt-1">Stay LockedIn. 🔒</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-full text-sm font-medium transition-colors"
          >
            + Create Community
          </button>
        </div>

        {/* My communities */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 text-zinc-300">My Communities</h2>
          {communities.length === 0 ? (
            <div className="border border-dashed border-zinc-800 rounded-2xl p-10 text-center text-zinc-500">
              You haven&apos;t joined any communities yet. Create one or join a public one below.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {communities.map((c) => (
                <Link key={c.id} href={`/community/${c.id}`}
                  className="bg-zinc-900 border border-zinc-800 hover:border-indigo-700 rounded-2xl p-5 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.community_members[0]?.forfeited ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>
                      {c.community_members[0]?.forfeited ? 'Forfeited' : 'Active'}
                    </span>
                  </div>
                  <p className="text-zinc-400 text-sm mb-3">{c.habit_description}</p>
                  <div className="flex gap-4 text-xs text-zinc-500">
                    <span>🔥 Streak: {c.community_members[0]?.current_streak || 0}</span>
                    <span>❌ Failures: {c.community_members[0]?.total_failures || 0}</span>
                    <span>💰 ${c.stake_amount}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Public communities */}
        <section>
          <h2 className="text-lg font-semibold mb-4 text-zinc-300">Discover Public Communities</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {publicCommunities.filter(pc => !communities.find(c => c.id === pc.id)).map((c) => (
              <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{c.name}</h3>
                  <span className="text-xs text-zinc-500">{c.duration_days}d · ${c.stake_amount}</span>
                </div>
                <p className="text-zinc-400 text-sm mb-4">{c.habit_description}</p>
                <button
                  onClick={() => handleJoin(c.id)}
                  className="text-sm bg-indigo-700 hover:bg-indigo-600 text-white px-4 py-1.5 rounded-full transition-colors"
                >
                  Join →
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Create community modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Create Community</h2>
              <button onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              {[
                { label: 'Community name', key: 'name', type: 'text', placeholder: 'e.g. Morning Gym Crew' },
                { label: 'Habit description', key: 'habit_description', type: 'text', placeholder: 'e.g. Go to the gym and take a photo' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-sm text-zinc-400 mb-1 block">{f.label}</label>
                  <input
                    type={f.type}
                    value={(form as any)[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    required
                    placeholder={f.placeholder}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Stake ($)</label>
                  <input type="number" min={1} value={form.stake_amount}
                    onChange={(e) => setForm({ ...form, stake_amount: +e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Duration (days)</label>
                  <input type="number" min={1} value={form.duration_days}
                    onChange={(e) => setForm({ ...form, duration_days: +e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Max failures</label>
                  <input type="number" min={0} value={form.max_failures}
                    onChange={(e) => setForm({ ...form, max_failures: +e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Visibility</label>
                  <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Start date</label>
                <input type="date" value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Submission window start</label>
                  <input type="time" value={form.submission_start}
                    onChange={(e) => setForm({ ...form, submission_start: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Submission window end</label>
                  <input type="time" value={form.submission_end}
                    onChange={(e) => setForm({ ...form, submission_end: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                </div>
              </div>

              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg font-medium transition-colors mt-2">
                Create Community
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
