interface Props {
  trackingId: string;
  className?: string;
}

export default function CoupangBanner({ trackingId, className = '' }: Props) {
  if (!trackingId) return null;

  const bannerUrl = `https://link.coupang.com/a/${trackingId}`;

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden ${className}`}>
      <a
        href={bannerUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block p-3 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors text-center"
      >
        <p className="text-xs text-red-600 dark:text-red-400 font-medium">쿠팡 파트너스</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">AI/개발 관련 추천 상품</p>
      </a>
      <p className="text-xs text-center text-gray-400 dark:text-gray-600 py-1">
        이 포스팅은 쿠팡 파트너스 활동의 일환으로 수수료를 제공받을 수 있습니다.
      </p>
    </div>
  );
}
