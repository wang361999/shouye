"use client";

import Link from "next/link";

export default function Footer({ siteName = "Gitd" }: { siteName?: string }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* 社区 */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">社区</h4>
            <ul className="space-y-2.5">
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
              <li>
                <Link href="/forum/category/tutorial" className="text-sm text-gray-400 hover:text-white transition-colors">
                  使用教程
                </Link>
              </li>
              <li>
                <Link href="/forum/category/feedback" className="text-sm text-gray-400 hover:text-white transition-colors">
                  反馈建议
                </Link>
              </li>
            </ul>
          </div>

          {/* 工具 */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">工具</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/tools" className="text-sm text-gray-400 hover:text-white transition-colors">
                  工具库
                </Link>
              </li>
              <li>
                <Link href="/#tools" className="text-sm text-gray-400 hover:text-white transition-colors">
                  热门工具
                </Link>
              </li>
              <li>
                <Link href="/products" className="text-sm text-gray-400 hover:text-white transition-colors">
                  开源项目
                </Link>
              </li>
              <li>
                <Link href="/collab" className="text-sm text-gray-400 hover:text-white transition-colors">
                  协同创作
                </Link>
              </li>
            </ul>
          </div>

          {/* 资源 */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">资源</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/docs" className="text-sm text-gray-400 hover:text-white transition-colors">
                  使用文档
                </Link>
              </li>
              <li>
                <Link href="/search" className="text-sm text-gray-400 hover:text-white transition-colors">
                  搜索内容
                </Link>
              </li>
              <li>
                <a
                  href="/api/forum/rss"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  RSS 订阅
                </a>
              </li>
              <li>
                <Link href="/sitemap.xml" className="text-sm text-gray-400 hover:text-white transition-colors">
                  站点地图
                </Link>
              </li>
            </ul>
          </div>

          {/* 关于 */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">关于</h4>
            <ul className="space-y-2.5">
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
              <li>
                <Link href="/sponsor" className="text-sm text-gray-400 hover:text-white transition-colors">
                  赞助我们
                </Link>
              </li>
            </ul>
          </div>

          {/* 品牌 */}
          <div className="col-span-2 md:col-span-1">
            <h4 className="mb-4 text-sm font-semibold text-white">{siteName}</h4>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              自研开发者协作平台。连接技术讨论、工具实践与开源协作，帮助开发者共建高质量内容生态。
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="px-3 py-1.5 text-xs font-medium text-white bg-white/10 rounded-md hover:bg-white/20 transition-colors"
              >
                登录
              </Link>
              <Link
                href="/register"
                className="px-3 py-1.5 text-xs font-medium text-gray-900 bg-white rounded-md hover:bg-gray-200 transition-colors"
              >
                注册
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-800">
          <p className="mb-4 rounded-lg border border-gray-800 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-gray-500">
            免责声明：Git 为通用开源工具名称，本站为独立运营的自研开发者协作平台，与 GitHub、Gitee 无关联。站内导入或展示的开源项目应保留原作者、原仓库链接及完整开源协议。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500">
              &copy; {currentYear} {siteName}. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>开发者社区</span>
              <span className="text-gray-700">·</span>
              <span>技术交流</span>
              <span className="text-gray-700">·</span>
              <span>开源协作</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export { Footer };
