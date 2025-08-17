import "@/styles/globals.css";

import AppLayout from '@/components/AppLayout';
import { useEffect } from 'react';
import { MiniAppProvider } from '@neynar/react';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    const id = setInterval(() => {
      fetch('/api/cron/sweep').catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, []);
  return (
    <MiniAppProvider analyticsEnabled={true}>
      <AppLayout>
        <Component {...pageProps} />
      </AppLayout>
    </MiniAppProvider>
  );
}
