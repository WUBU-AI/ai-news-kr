import Script from 'next/script';

interface Props {
  publisherId: string;
}

// strategy="beforeInteractive" ensures the script tag is present in the
// server-rendered HTML so AdSense crawlers can verify site ownership.
export default function AdSenseScript({ publisherId }: Props) {
  if (!publisherId) return null;
  return (
    <Script
      id="adsense-script"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`}
      crossOrigin="anonymous"
      strategy="beforeInteractive"
    />
  );
}
