import { MiniAppProvider } from '@neynar/react';

export default function ClientMiniProvider({ children }) {
  return (
    <MiniAppProvider analyticsEnabled={true}>
      {children}
    </MiniAppProvider>
  );
}



