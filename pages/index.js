import Head from "next/head";
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <>
      <Head>
        <title>ArguMint</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="px-4 py-10 sm:py-14 max-w-4xl mx-auto">
        <section className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            <span className="brand-mark brand-gold">ArguMint</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-400 mt-3">
            short, smart debates. automatic scoring. earn tokens.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link href="/prompt" className="rounded-full btn-mint px-4 py-2 text-sm font-medium">Get a prompt</Link>
            <Link href="/chat" className="rounded-full bg-gray-800 hover:bg-gray-700 px-4 py-2 text-sm font-medium">
              <span className="inline-flex items-center gap-2">
                <Image src="/icon.jpeg" alt="icon" width={16} height={16} className="rounded-sm border border-gold" />
                Join debate
              </span>
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border-gold bg-gray-900/40 p-4 shadow-soft">
            <div className="text-sm font-medium mb-1">1. Respond</div>
            <div className="text-xs text-gray-400">Pick a prompt and submit your take before the timer ends.</div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 shadow-soft">
            <div className="text-sm font-medium mb-1">2. Debate</div>
            <div className="text-xs text-gray-400">We group you into 2–3 person chats. You get 10 minutes to make your case.</div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 shadow-soft">
            <div className="text-sm font-medium mb-1">3. Score & tokens</div>
            <div className="text-xs text-gray-400">AI scores the debate, declares a winner, and awards tokens to everyone.</div>
          </div>
        </section>

        <section className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/prompt" className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 shadow-soft hover:border-gold transition">
            <div className="text-lg font-semibold">Browse prompts</div>
            <div className="text-xs text-gray-400">Always five active prompts. New ones roll in automatically.</div>
          </Link>
          <Link href="/profile" className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 shadow-soft hover:border-gold transition">
            <div className="text-lg font-semibold">Your tokens</div>
            <div className="text-xs text-gray-400">Earn wins. Spend on custom prompts and perks.</div>
          </Link>
        </section>
      </main>
    </>
  );
}
