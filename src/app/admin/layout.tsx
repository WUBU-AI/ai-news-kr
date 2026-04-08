import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="font-bold text-gray-900 dark:text-gray-100 text-lg">
            🛠 관리자
          </Link>
          <div className="flex items-center gap-3 text-sm ml-4">
            <Link href="/admin" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              대시보드
            </Link>
            <Link href="/admin/settings" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              설정
            </Link>
          </div>
          <Link href="/" className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← 사이트로
          </Link>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
