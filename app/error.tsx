'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[APP ERROR]', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">😵</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          页面出错了
        </h1>
        <p className="text-gray-500 mb-6">
          抱歉，页面加载时发生了错误。请尝试刷新页面，如果问题持续存在请联系管理员。
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4">
            错误代码: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            重试
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
