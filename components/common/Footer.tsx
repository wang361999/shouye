"use client";

import Link from "next/link";

export default function Footer({ siteName = "ET Studio" }: { siteName?: string }) {
  return (
    <footer className="bg-gray-800 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
          {/* 版权 */}
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} {siteName}. All rights reserved.
          </p>

          {/* 链接 */}
          <nav className="flex items-center space-x-6">
            <Link
              href="/agreements/terms"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              用户协议
            </Link>
            <Link
              href="/agreements/privacy"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              隐私政策
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export { Footer };
