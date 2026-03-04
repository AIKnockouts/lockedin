'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setDisplayName(data.display_name || '')
        setTimezone(data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone)
      }
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    await supabase.from('profiles').upsert({ id: user.id, display_name: displayName, timezone })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 text-sm">← Dashboard</Link>
        <span className="text-lg font-bold">Settings</span>
        <div />
      </nav>

      <div className="max-w-lg mx-auto px-6 py-10">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-6">Profile Settings</h2>
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full bg-zinc-800/50 border border-zinc-700 text-zinc-400 rounded-lg px-4 py-2.5 text-sm cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
              >
                {['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
                  'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney'].map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {saved && <span className="text-green-400 text-sm">✓ Saved!</span>}
            </div>
          </form>
        </div>

        <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="font-semibold mb-4 text-red-400">Danger Zone</h3>
          <button
            onClick={handleLogout}
            className="border border-red-800 hover:bg-red-900/30 text-red-400 px-5 py-2 rounded-lg text-sm transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}
