import "@/styles/globals.css";

import AppLayout from '@/components/AppLayout';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';

const ClientMiniProvider = dynamic(() => import('@/components/ClientMiniProvider'), { ssr: false });

export default function App({ Component, pageProps }) {
  useEffect(() => {
    const id = setInterval(() => {
      fetch('/api/cron/sweep').catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, []);
  return (
    <ClientMiniProvider>
      <AppLayout>
        <Component {...pageProps} />
      </AppLayout>
    </ClientMiniProvider>
  );
}
