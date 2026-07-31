"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Footer() {
  const [siteName, setSiteName] = useState<string>("ET Studio");

  // 动态获取网站名称（fetch 失败时静默降级为默认值）
  useEffect(() => {
    let active = true;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (active && data?.site_name) {
          setSiteName(data.site_name);
        }
      })
      .catch(() => {
        // 静默降级，不弹 toast
      });
    return () => {
      active = false;
    };
  }, []);

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
