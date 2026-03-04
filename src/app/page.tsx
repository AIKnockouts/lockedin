import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <span className="text-xl font-bold text-indigo-400">LockedIn</span>
        <div className="flex gap-4">
          <Link href="/login" className="text-zinc-400 hover:text-white transition-colors">
            Log in
          </Link>
          <Link
            href="/signup"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
          >
            Sign up free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-32 gap-6">
        <div className="inline-block bg-indigo-900/40 text-indigo-300 text-sm px-4 py-1 rounded-full border border-indigo-700 mb-2">
          AI-Verified Accountability
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight max-w-3xl">
          Make your habits{' '}
          <span className="text-indigo-400">non-optional.</span>
        </h1>
        <p className="text-zinc-400 text-xl max-w-xl">
          Form small communities. Stake $5. Submit daily photo proof. Claude AI verifies you actually did it. Fail and lose your stake.
        </p>
        <div className="flex gap-4 mt-4">
          <Link
            href="/signup"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-full text-lg font-semibold transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/leaderboard"
            className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-8 py-3 rounded-full text-lg font-semibold transition-colors"
          >
            Leaderboard
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: '1', title: 'Create or join a community', desc: 'Pick a habit, set the rules, stake $5 to join.' },
            { step: '2', title: 'Submit daily photo proof', desc: 'Upload an image every day within the submission window.' },
            { step: '3', title: 'Claude AI verifies', desc: 'Our AI confirms you completed the habit. Fail too often and you forfeit your stake.' },
          ].map((item) => (
            <div key={item.step} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold mb-4">
                {item.step}
              </div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-zinc-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 py-12 pb-32">
        <h2 className="text-3xl font-bold text-center mb-12">Built for discipline</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { icon: '🔒', title: 'Financial Stakes', desc: 'Real money on the line means real commitment.' },
            { icon: '🤖', title: 'AI Verification', desc: 'Claude Vision verifies every photo submission automatically.' },
            { icon: '📊', title: 'Streak Tracking', desc: 'Track your daily streak and overall success rate.' },
            { icon: '💬', title: 'Community Chat', desc: 'Encourage each other in community-specific chats.' },
            { icon: '🏆', title: 'Leaderboard', desc: 'Daily rankings keep you accountable publicly.' },
            { icon: '⚡', title: 'Anti-Cheat', desc: 'EXIF checks, image hashing, and rate limiting prevent gaming the system.' },
          ].map((f) => (
            <div key={f.title} className="flex gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <span className="text-2xl">{f.icon}</span>
              <div>
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-zinc-400 text-sm">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-8 text-center text-zinc-500 text-sm">
        <p>LockedIn &copy; 2026 · AIKnockouts · Make discipline public.</p>
      </footer>
    </div>
  )
}
