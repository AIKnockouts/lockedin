'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface Submission {
  id: string
  user_id: string
  date: string
  image_url: string
  ai_result: string
  confidence: number
  final_status: string
  profiles: { display_name: string; avatar_url: string }
}

interface Message {
  id: string
  user_id: string
  content: string
  created_at: string
  profiles: { display_name: string }
}

interface Member {
  user_id: string
  total_failures: number
  current_streak: number
  forfeited: boolean
  stake_paid: boolean
  profiles: { display_name: string; avatar_url: string }
}

interface Community {
  id: string
  name: string
  habit_description: string
  stake_amount: number
  duration_days: number
  max_failures: number
  start_date: string
  submission_start: string
  submission_end: string
  visibility: string
}

export default function CommunityPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [community, setCommunity] = useState<Community | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [chatInput, setChatInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [activeTab, setActiveTab] = useState<'feed' | 'chat' | 'members'>('feed')
  const fileRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUser(user)
      fetchAll()
    })

    // Subscribe to new messages
    const channel = supabase.channel(`community-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `community_id=eq.${id}` },
        () => fetchMessages())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchAll() {
    const [commRes, memRes, subRes, msgRes] = await Promise.all([
      supabase.from('communities').select('*').eq('id', id).single(),
      supabase.from('community_members').select('*, profiles(display_name, avatar_url)').eq('community_id', id),
      supabase.from('daily_submissions').select('*, profiles(display_name, avatar_url)').eq('community_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('messages').select('*, profiles(display_name)').eq('community_id', id).order('created_at').limit(100),
    ])
    if (commRes.data) setCommunity(commRes.data)
    if (memRes.data) setMembers(memRes.data)
    if (subRes.data) setSubmissions(subRes.data)
    if (msgRes.data) setMessages(msgRes.data)
  }

  async function fetchMessages() {
    const { data } = await supabase.from('messages').select('*, profiles(display_name)').eq('community_id', id).order('created_at').limit(100)
    if (data) setMessages(data)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user || !community) return
    setUploading(true)
    setUploadStatus('Uploading image…')

    const today = new Date().toISOString().split('T')[0]
    const path = `submissions/${community.id}/${user.id}/${today}.jpg`

    const { error: uploadError } = await supabase.storage.from('submissions').upload(path, file, { upsert: false })
    if (uploadError) {
      if (uploadError.message.includes('already exists')) {
        setUploadStatus('Already submitted today!')
      } else {
        setUploadStatus('Upload failed: ' + uploadError.message)
      }
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('submissions').getPublicUrl(path)
    setUploadStatus('Verifying with AI…')

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        community_id: community.id,
        image_url: urlData.publicUrl,
        habit_description: community.habit_description,
        date: today,
      }),
    })

    const result = await res.json()
    if (result.error) {
      setUploadStatus('Error: ' + result.error)
    } else {
      const status = result.final_status === 'SUCCESS' ? '✅ Verified!' : '❌ Not verified'
      setUploadStatus(`${status} (${result.ai_result}, confidence: ${(result.confidence * 100).toFixed(0)}%)`)
      fetchAll()
    }
    setUploading(false)
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!chatInput.trim() || !user) return
    await supabase.from('messages').insert({ community_id: id, user_id: user.id, content: chatInput.trim() })
    setChatInput('')
  }

  const today = new Date().toISOString().split('T')[0]
  const mySubmissionToday = submissions.find(s => s.user_id === user?.id && s.date === today)
  const isMember = members.some(m => m.user_id === user?.id)

  if (!community) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-400">Loading…</div>

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 text-sm">← Dashboard</Link>
        <span className="text-lg font-bold">{community.name}</span>
        <span className="text-xs text-zinc-500">{members.length} members · ${community.stake_amount} stake</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Community header */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold mb-1">{community.name}</h2>
              <p className="text-zinc-400 text-sm mb-3">{community.habit_description}</p>
              <div className="flex gap-4 text-xs text-zinc-500 flex-wrap">
                <span>📅 {community.duration_days} days</span>
                <span>💰 ${community.stake_amount}</span>
                <span>❌ Max {community.max_failures} failure(s)</span>
                <span>🕐 {community.submission_start} – {community.submission_end}</span>
              </div>
            </div>
          </div>

          {isMember && (
            <div className="mt-5 border-t border-zinc-800 pt-5">
              {mySubmissionToday ? (
                <div className={`flex items-center gap-3 p-3 rounded-lg ${mySubmissionToday.final_status === 'SUCCESS' ? 'bg-green-900/30 border border-green-800' : 'bg-red-900/30 border border-red-800'}`}>
                  <span className="text-2xl">{mySubmissionToday.final_status === 'SUCCESS' ? '✅' : '❌'}</span>
                  <div>
                    <p className="font-medium text-sm">Today&apos;s submission {mySubmissionToday.final_status === 'SUCCESS' ? 'verified!' : 'not verified'}</p>
                    <p className="text-xs text-zinc-400">{mySubmissionToday.ai_result} · {(mySubmissionToday.confidence * 100).toFixed(0)}% confidence</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-zinc-400 mb-3">Submit today&apos;s proof photo:</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-full text-sm font-medium transition-colors"
                    >
                      {uploading ? 'Processing…' : '📸 Upload Photo'}
                    </button>
                    {uploadStatus && <span className="text-sm text-zinc-400">{uploadStatus}</span>}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['feed', 'chat', 'members'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
            >
              {tab} {tab === 'members' && `(${members.length})`}
            </button>
          ))}
        </div>

        {/* Feed */}
        {activeTab === 'feed' && (
          <div className="space-y-4">
            {submissions.length === 0 ? (
              <div className="text-center text-zinc-500 py-12">No submissions yet. Be the first!</div>
            ) : (
              submissions.map((sub) => (
                <div key={sub.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-4">
                  {sub.image_url && (
                    <img src={sub.image_url} alt="Submission" className="w-24 h-24 object-cover rounded-lg flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{sub.profiles?.display_name || 'User'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${sub.final_status === 'SUCCESS' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                        {sub.final_status === 'SUCCESS' ? '✅ Verified' : '❌ Failed'}
                      </span>
                    </div>
                    <p className="text-zinc-500 text-xs">{sub.date}</p>
                    <p className="text-zinc-400 text-xs mt-1">AI: {sub.ai_result} · {(sub.confidence * 100).toFixed(0)}% confidence</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Chat */}
        {activeTab === 'chat' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="h-80 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.user_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-3 py-2 rounded-2xl text-sm ${msg.user_id === user?.id ? 'bg-indigo-700 text-white' : 'bg-zinc-800 text-zinc-200'}`}>
                    {msg.user_id !== user?.id && <p className="text-xs text-zinc-400 mb-0.5">{msg.profiles?.display_name}</p>}
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {isMember && (
              <form onSubmit={sendMessage} className="border-t border-zinc-800 flex">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1 bg-transparent px-4 py-3 text-sm outline-none text-white placeholder-zinc-600"
                />
                <button type="submit" className="px-4 text-indigo-400 hover:text-indigo-300 font-medium text-sm">Send</button>
              </form>
            )}
          </div>
        )}

        {/* Members */}
        {activeTab === 'members' && (
          <div className="space-y-3">
            {members.map((m) => (
              <div key={m.user_id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {m.profiles?.avatar_url ? (
                    <img src={m.profiles.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-800 flex items-center justify-center text-sm font-bold">
                      {m.profiles?.display_name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-sm">{m.profiles?.display_name || 'User'}</p>
                    <p className="text-xs text-zinc-500">Streak: {m.current_streak} · Failures: {m.total_failures}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.forfeited && <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full">Forfeited</span>}
                  {m.stake_paid && !m.forfeited && <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">Staked ✓</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
