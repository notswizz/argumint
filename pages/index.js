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
      <main className="px-4 py-10 sm:py-16 max-w-5xl mx-auto">
        <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 sm:p-10 shadow-soft mb-10">
          <div className="relative z-10 text-center">
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Welcome to</div>
            <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">
              <span className="brand-mark brand-gold">ArguMint</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-3 max-w-2xl mx-auto">
              --- post takes, debate live, earn tokens ---
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link href="/debate" className="rounded-full btn-mint px-4 py-2 text-sm sm:text-base font-medium">--- ArguMint --- </Link>
              
            </div>
          </div>
          <div className="pointer-events-none absolute -right-10 -bottom-10 w-52 h-52 sm:w-72 sm:h-72 rounded-full bg-brand-100/40 blur-3xl" />
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border-gold bg-white p-5 shadow-soft">
            <div className="text-sm font-medium mb-1">1. Post your take</div>
            <div className="text-xs text-slate-600">Choose a prompt and submit your take. We’ll use it to match you into a debate.</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="text-sm font-medium mb-1">2. Get matched to debate</div>
            <div className="text-xs text-slate-600">You’re grouped into 2–3 person chat rooms to make your case—quick.</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="text-sm font-medium mb-1">3. AI scores winners</div>
            <div className="text-xs text-slate-600">Each group is scored and individual winners are picked based on argument quality.</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="text-sm font-medium mb-1">4. Earn rewards</div>
            <div className="text-xs text-slate-600">Individual winners earn Solana. The smartest group also wins bonus tokens.</div>
          </div>
        </section>
      </main>
    </>
  );
}
