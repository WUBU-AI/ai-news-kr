import Script from 'next/script';

interface Props {
  publisherId: string;
}

export default function AdSenseScript({ publisherId }: Props) {
  if (!publisherId) return null;
  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
