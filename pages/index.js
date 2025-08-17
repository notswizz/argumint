import Head from "next/head";
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <>
      <Head>
        <title>ArguMint</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <main className="px-4 py-10 sm:py-16 max-w-6xl mx-auto">
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-[#eef6ff] to-slate-50 p-8 sm:p-14 shadow-soft mb-12">
          <div className="absolute inset-0 -z-10">
            <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#7cc8ff]/25 blur-[64px]" />
            <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-fuchsia-300/20 blur-[68px]" />
          </div>
          <div className="relative z-10 text-center">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500 mb-3">Welcome to</div>
            <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight">
              <span className="brand-mark brand-gold drop-shadow-sm">ArguMint</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-4 max-w-2xl mx-auto">
              Post takes. Debate live. Earn tokens.
            </p>
            <div className="mt-8 flex items-center justify-center">
              <div className="relative inline-flex rounded-full overflow-hidden shadow ring-1 ring-slate-200">
                <Link
                  href="/debate"
                  className="relative rounded-l-full bg-[#7cc8ff] hover:bg-[#69b8f2] px-6 py-3 text-base font-semibold text-slate-900"
                  aria-label="Argu: Enter debates"
                >
                  Argu
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white/95 shadow-inner" />
                </Link>
                <Link
                  href="/prompt"
                  className="relative rounded-r-full bg-white hover:bg-slate-50 px-6 py-3 text-base font-semibold text-slate-800 border-l border-slate-200"
                  aria-label="Mint: Post a take"
                >
                  Mint
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#7cc8ff' }} />
                </Link>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute -right-10 -bottom-10 w-72 h-72 sm:w-[26rem] sm:h-[26rem] rounded-full bg-brand-100/40 blur-3xl" />
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl border-gold bg-white p-5 shadow-soft hover:shadow-md transition-shadow">
            <div className="text-sm font-semibold mb-1">1. Post your take</div>
            <div className="text-xs text-slate-600">Choose a prompt and submit your take. We’ll use it to match you into a debate.</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft hover:shadow-md transition-shadow">
            <div className="text-sm font-semibold mb-1">2. Get matched to debate</div>
            <div className="text-xs text-slate-600">You’re grouped into 2–3 person chat rooms to make your case—quick.</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft hover:shadow-md transition-shadow">
            <div className="text-sm font-semibold mb-1">3. AI scores winners</div>
            <div className="text-xs text-slate-600">Each group is scored and individual winners are picked based on argument quality.</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft hover:shadow-md transition-shadow">
            <div className="text-sm font-semibold mb-1">4. Earn rewards</div>
            <div className="text-xs text-slate-600">Individual winners earn Solana. The smartest group also wins bonus tokens.</div>
          </div>
        </section>
      </main>
    </>
  );
}
