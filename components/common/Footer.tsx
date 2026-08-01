"use client";

import Link from "next/link";

export default function Footer({ siteName = "ET Studio" }: { siteName?: string }) {
  return (
    <footer className="bg-gray-800 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* 社区 */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">社区</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/forum" className="text-sm text-gray-400 hover:text-white transition-colors">
                  全部帖子
                </Link>
              </li>
              <li>
                <Link href="/forum/new" className="text-sm text-gray-400 hover:text-white transition-colors">
                  发布新帖
                </Link>
              </li>
              <li>
                <Link href="/forum/category/announcement" className="text-sm text-gray-400 hover:text-white transition-colors">
                  社区公告
                </Link>
              </li>
            </ul>
          </div>

          {/* 工具 */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">工具</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/#tools" className="text-sm text-gray-400 hover:text-white transition-colors">
                  浏览工具
                </Link>
              </li>
              <li>
                <Link href="/products" className="text-sm text-gray-400 hover:text-white transition-colors">
                  产品中心
                </Link>
              </li>
            </ul>
          </div>

          {/* 关于 */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">关于</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/agreements/terms" className="text-sm text-gray-400 hover:text-white transition-colors">
                  用户协议
                </Link>
              </li>
              <li>
                <Link href="/agreements/privacy" className="text-sm text-gray-400 hover:text-white transition-colors">
                  隐私政策
                </Link>
              </li>
            </ul>
          </div>

          {/* 品牌 */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">{siteName}</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              开发者交流、分享、成长的社区
            </p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-700">
          <p className="text-center text-sm text-gray-400">
            &copy; {new Date().getFullYear()} {siteName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export { Footer };
