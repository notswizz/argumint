import Document, { Html, Head, Main, NextScript } from "next/document";

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    return (
      <Html lang="en" className="dark">
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="format-detection" content="telephone=no, address=no, email=no" />
          <meta name="theme-color" content="#ffffff" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
          <link rel="icon" href="/icon.jpeg" type="image/jpeg" />
          <link rel="apple-touch-icon" href="/icon.jpeg" />
          <meta
            name="fc:frame"
            content='{"version":"next","imageUrl":"https://argumint7.vercel.app/opengraph-image","button":{"title":"Open","action":{"type":"launch_miniapp","name":"ArguMint","url":"https://argumint7.vercel.app","splashImageUrl":"https://argumint7.vercel.app/icon.jpeg","splashBackgroundColor":"#ffffff"}}}'
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
