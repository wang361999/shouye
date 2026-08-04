'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Container } from '@/components/common/Container';

// ============ 文档章节 ============
const SECTIONS = [
  {
    id: 'intro',
    title: '平台介绍',
    icon: '📋',
  },
  {
    id: 'quick-start',
    title: '快速开始',
    icon: '🚀',
  },
  {
    id: 'community',
    title: '社区功能',
    icon: '💬',
  },
  {
    id: 'profile',
    title: '个人中心',
    icon: '👤',
  },
  {
    id: 'dark-mode',
    title: '暗色模式',
    icon: '🌙',
  },
  {
    id: 'mobile',
    title: '移动端使用',
    icon: '📱',
  },
  {
    id: 'github-code',
    title: '代码仓库文件嵌入',
    icon: '📄',
  },
  {
    id: 'collab',
    title: '协同创作召集令',
    icon: '🚀',
  },
  {
    id: 'api',
    title: 'API 文档',
    icon: '🔌',
  },
  {
    id: 'faq',
    title: '常见问题',
    icon: '❓',
  },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('intro');

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Container className="py-8">
      {/* 返回链接 */}
      <Link
        href="/"
        className="inline-block text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4"
      >
        &larr; 返回首页
      </Link>

      {/* 页面标题 */}
      <h1 className="text-2xl font-bold text-gray-900 mb-2">📚 文档中心</h1>
      <p className="text-sm text-gray-500 mb-8">
        了解平台功能、使用指南和 API 接口说明
      </p>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* 左侧目录 */}
        <aside className="w-full lg:w-56 flex-shrink-0">
          <nav className="lg:sticky lg:top-20 bg-white rounded-xl border border-gray-200 p-3">
            <ul className="space-y-1">
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <button
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="mr-2">{section.icon}</span>
                    {section.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* 右侧内容 */}
        <div className="flex-1 min-w-0 space-y-12">
          {/* 平台介绍 */}
          <section id="intro" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📋 平台介绍</h2>
            <div className="prose prose-sm max-w-none bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-gray-600 leading-relaxed mb-4">
                本平台是一个以社区为核心的开发者交流平台，提供论坛讨论、帖子互动、产品授权等功能。
              </p>
              <h3 className="text-base font-semibold text-gray-800 mb-2">核心功能</h3>
              <ul className="text-sm text-gray-600 space-y-1.5 ml-4 list-disc">
                <li>社区论坛：发帖、评论、点赞、收藏、分类筛选</li>
                <li>个人中心：资料管理、我的帖子/评论/点赞、密码修改</li>
                <li>产品中心：产品展示、授权码购买与管理</li>
                <li>暗色模式：一键切换明暗主题</li>
                <li>移动端适配：底部导航栏、响应式布局</li>
                <li>用量监控：实时追踪 Vercel 资源使用情况</li>
              </ul>
            </div>
          </section>

          {/* 快速开始 */}
          <section id="quick-start" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🚀 快速开始</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">1. 注册账号</h3>
                <p className="text-sm text-gray-600">
                  点击页面右上角「注册」按钮，填写用户名、邮箱和密码即可完成注册。
                  也支持通过 GitHub 账号一键登录。
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">2. 完善资料</h3>
                <p className="text-sm text-gray-600">
                  登录后进入「个人中心」，可设置头像（支持图片 URL 或 Emoji）、
                  修改用户名和编写个人简介。
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">3. 参与社区</h3>
                <p className="text-sm text-gray-600">
                  进入「社区论坛」，浏览帖子、发表新帖、评论互动。
                  支持 Markdown 格式编写帖子内容。
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">4. 搜索内容</h3>
                <p className="text-sm text-gray-600">
                  使用顶部搜索框可快速搜索帖子标题和内容，
                  移动端点击底部导航栏的搜索图标即可使用。
                </p>
              </div>
            </div>
          </section>

          {/* 社区功能 */}
          <section id="community" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-4">💬 社区功能</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">发帖</h3>
                <p className="text-sm text-gray-600">
                  登录后点击「发布新帖」按钮，填写标题和内容（支持 Markdown），
                  选择分类后即可发布。帖子发布后默认为「已发布」状态。
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">评论与回复</h3>
                <p className="text-sm text-gray-600">
                  在帖子详情页可发表评论，支持多级回复。评论会自动进行敏感词检测，
                  命中敏感词的评论需管理员审核后才会显示。
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">点赞与收藏</h3>
                <p className="text-sm text-gray-600">
                  可对帖子进行点赞和收藏操作。在个人中心的「我的点赞」标签页
                  可查看所有点赞过的帖子。
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">分类与排序</h3>
                <p className="text-sm text-gray-600">
                  帖子支持按分类筛选（公告、反馈、教程、闲聊等），
                  并可按「最新」或「热门」排序。置顶帖子始终排在最前。
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">帖子编辑与删除</h3>
                <p className="text-sm text-gray-600">
                  帖子作者可编辑和删除自己的帖子（软删除）。
                  管理员可执行置顶、加精、锁定等管理操作。
                </p>
              </div>
            </div>
          </section>

          {/* 个人中心 */}
          <section id="profile" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-4">👤 个人中心</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">资料管理</h3>
                <p className="text-sm text-gray-600">
                  支持修改头像（图片 URL 或 Emoji）、用户名和个人简介。
                  头像修改后会在全站同步更新。
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">我的帖子</h3>
                <p className="text-sm text-gray-600">
                  查看自己发布的所有帖子，支持分页浏览，可快速编辑或查看。
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">我的评论</h3>
                <p className="text-sm text-gray-600">
                  查看自己在各帖子下发表的所有评论，可快速跳转到原帖。
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">我的点赞</h3>
                <p className="text-sm text-gray-600">
                  查看所有点赞过的帖子列表，支持分页浏览。
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">等级系统</h3>
                <p className="text-sm text-gray-600">
                  通过发帖、评论、点赞等互动行为积累经验值，提升等级。
                  等级越高，称号越炫酷。
                </p>
              </div>
            </div>
          </section>

          {/* 暗色模式 */}
          <section id="dark-mode" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🌙 暗色模式</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                点击导航栏右侧的太阳/月亮图标可切换明暗主题。
                系统会自动记住你的选择，下次访问时自动应用。
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                首次访问时，系统会根据你的浏览器偏好自动选择主题。
                如果你的浏览器设置了暗色模式偏好，平台会自动切换到暗色。
              </p>
            </div>
          </section>

          {/* 移动端 */}
          <section id="mobile" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📱 移动端使用</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                平台已全面适配移动端，在手机浏览器中访问会自动展示响应式布局。
              </p>
              <h3 className="text-base font-semibold text-gray-800 mb-2">底部导航栏</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                移动端底部提供四个快捷入口：首页、社区、搜索、我的。
                可快速在不同功能区之间切换。
              </p>
              <h3 className="text-base font-semibold text-gray-800 mb-2">搜索功能</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                点击底部导航栏的搜索图标，进入搜索页面输入关键词即可搜索帖子。
              </p>
            </div>
          </section>

          {/* 代码仓库文件嵌入 */}
          <section id="github-code" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📄 代码仓库文件嵌入</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                在帖子中嵌入外部代码仓库的源代码文件，自动获取并语法高亮显示。
                支持两种方式：搜索引用和手动嵌入。
              </p>

              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">方式一：搜索引用（推荐）</h3>
                <p className="text-sm text-gray-600 mb-2">
                  在发帖编辑器中，点击「代码引用」按钮，输入关键词搜索开源代码，
                  点击搜索结果即可自动插入代码引用到帖子内容中。
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  支持筛选条件，点击搜索框右侧的「筛选」按钮可展开筛选面板：
                </p>
                <ul className="text-sm text-gray-600 space-y-1.5 ml-4 list-disc">
                  <li>
                    <strong>编程语言</strong>：一键切换 TypeScript、Python、Go 等 20+ 常用语言
                  </li>
                  <li>
                    <strong>限定仓库</strong>：输入 <code className="px-1 py-0.5 bg-gray-100 rounded text-gray-600">owner/repo</code> 格式限定搜索范围
                  </li>
                  <li>
                    <strong>限定用户/组织</strong>：只搜索指定用户或组织下的代码
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">方式二：粘贴链接自动识别</h3>
                <p className="text-sm text-gray-600 mb-2">
                  在编辑器中直接粘贴代码仓库文件链接，系统会自动识别并转换为代码块：
                </p>
                <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto">
                  <div>https://github.com/facebook/react/blob/main/README.md</div>
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  粘贴后自动转换为 github-code 代码块，支持 blob 链接和 raw 链接
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">方式三：短代码</h3>
                <p className="text-sm text-gray-600 mb-2">
                  使用 <code className="px-1 py-0.5 bg-gray-100 rounded text-gray-600">[github]URL[/github]</code> 短代码包裹代码仓库文件链接：
                </p>
                <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto">
                  <div>[github]https://github.com/owner/repo/blob/main/web3.md[/github]</div>
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">方式四：手动嵌入</h3>
                <p className="text-sm text-gray-600 mb-2">
                  在 Markdown 中使用 <code className="px-1 py-0.5 bg-gray-100 rounded text-gray-600">github-code</code> 代码块：
                </p>
                <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto">
                  <div>{'```github-code'}</div>
                  <div>owner/repo/path/to/file.ts</div>
                  <div>{'```'}</div>
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">可选参数</h3>
                <p className="text-sm text-gray-600 mb-2">
                  在路径后添加查询参数：
                </p>
                <ul className="text-sm text-gray-600 space-y-1.5 ml-4 list-disc">
                  <li>
                    <code className="px-1 py-0.5 bg-gray-100 rounded text-gray-600">ref=main</code> -
                    指定分支/tag/commit（默认 HEAD）
                  </li>
                  <li>
                    <code className="px-1 py-0.5 bg-gray-100 rounded text-gray-600">lines=10-30</code> -
                    只显示第 10-30 行
                  </li>
                  <li>
                    <code className="px-1 py-0.5 bg-gray-100 rounded text-gray-600">lines=10</code> -
                    只显示第 10 行
                  </li>
                </ul>
                <div className="mt-3 bg-gray-900 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto">
                  <div>{'```github-code'}</div>
                  <div>facebook/react/packages/react/index.ts?ref=v18.0.0&amp;lines=1-20</div>
                  <div>{'```'}</div>
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">支持的文件类型</h3>
                <p className="text-sm text-gray-600">
                  JavaScript、TypeScript、Python、Go、Rust、Java、C/C++、C#、PHP、
                  Ruby、Swift、Kotlin、Bash、YAML、JSON、XML、HTML、CSS、SCSS、SQL、
                  Markdown 等主流语言均支持语法高亮。文件大小限制 100KB 以内。
                </p>
              </div>
            </div>
          </section>

          {/* 协同创作召集令 */}
          <section id="collab" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🚀 协同创作召集令</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                协同创作召集令是平台的核心功能，帮助开发者发起开源协作项目，
                邀请社区成员共同参与代码编写。支持手动添加已有仓库或连接第三方仓库服务创建新仓库，
                包含任务清单、团队管理、提交贡献、审核流程等完整协作功能。
              </p>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-700">
                  📖 完整使用教程请查看：
                  <Link href="/collab/guide" className="font-semibold underline ml-1">
                    召集令使用指南
                  </Link>
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">发起召集令</h3>
                <p className="text-sm text-gray-600 mb-2">
                  访问 <Link href="/collab/new" className="text-blue-600 underline">发起召集令</Link> 页面，
                  填写项目信息并关联代码仓库。支持两种方式：
                </p>
                <ul className="text-sm text-gray-600 space-y-1.5 ml-4 list-disc">
                  <li><strong>手动添加</strong>：输入已有仓库 URL，自动解析仓库信息</li>
                  <li><strong>创建新仓库</strong>：通过已连接的第三方仓库服务创建新仓库（需配置 Token）</li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">任务管理</h3>
                <p className="text-sm text-gray-600">
                  项目 Owner/Maintainer 可创建开发任务，成员认领任务后开始开发。
                  任务状态流转：待认领 → 进行中 → 待审核 → 已完成。
                  支持优先级（紧急/高/中/低）、截止日期、指派人和标签。
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">提交贡献与审核</h3>
                <p className="text-sm text-gray-600">
                  成员在代码仓库提交代码后，可在平台记录贡献（commit/PR/issue/docs），
                  关联任务和分支信息。Owner/Maintainer 审核贡献，通过或拒绝。
                </p>
              </div>

              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">协作规范</h3>
                <ul className="text-sm text-gray-600 space-y-1.5 ml-4 list-disc">
                  <li>主分支受保护，通过 Pull Request 提交代码</li>
                  <li>每次提交需通过 CI 自动检查（语法、格式、测试）</li>
                  <li>任务需先认领再开发，避免重复工作</li>
                  <li>Owner/Maintainer 审核 PR 后合并到主分支</li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">角色权限</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-3 py-2 font-medium text-gray-600">角色</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">权限说明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Owner</span></td>
                        <td className="px-3 py-2 text-gray-600">项目所有者，全部管理权限</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Maintainer</span></td>
                        <td className="px-3 py-2 text-gray-600">维护者，可管理任务和审核贡献</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Member</span></td>
                        <td className="px-3 py-2 text-gray-600">普通成员，可认领任务和提交贡献</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/collab"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  🐙 浏览召集令
                </Link>
                <Link
                  href="/collab/new"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  🚀 发起召集令
                </Link>
                <Link
                  href="/collab/guide"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  📖 完整教程
                </Link>
              </div>
            </div>
          </section>

          {/* API 文档 */}
          <section id="api" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🔌 API 文档</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                平台提供 RESTful API，大部分接口需要登录后才能访问（通过 Bearer Token 鉴权）。
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-3 py-2 font-medium text-gray-600">接口</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">方法</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">说明</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">鉴权</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">/api/forum/posts</td>
                      <td className="px-3 py-2"><span className="text-green-600">GET</span></td>
                      <td className="px-3 py-2 text-gray-600">获取帖子列表</td>
                      <td className="px-3 py-2 text-gray-400">否</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">/api/forum/posts</td>
                      <td className="px-3 py-2"><span className="text-blue-600">POST</span></td>
                      <td className="px-3 py-2 text-gray-600">发布新帖</td>
                      <td className="px-3 py-2 text-gray-400">是</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">/api/forum/posts/[id]</td>
                      <td className="px-3 py-2"><span className="text-green-600">GET</span></td>
                      <td className="px-3 py-2 text-gray-600">获取帖子详情</td>
                      <td className="px-3 py-2 text-gray-400">否</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">/api/forum/posts/[id]</td>
                      <td className="px-3 py-2"><span className="text-orange-600">PUT</span></td>
                      <td className="px-3 py-2 text-gray-600">编辑帖子</td>
                      <td className="px-3 py-2 text-gray-400">是</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">/api/forum/comments</td>
                      <td className="px-3 py-2"><span className="text-green-600">GET</span></td>
                      <td className="px-3 py-2 text-gray-600">获取评论列表</td>
                      <td className="px-3 py-2 text-gray-400">否</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">/api/forum/comments</td>
                      <td className="px-3 py-2"><span className="text-blue-600">POST</span></td>
                      <td className="px-3 py-2 text-gray-600">发表评论</td>
                      <td className="px-3 py-2 text-gray-400">是</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">/api/forum/interact</td>
                      <td className="px-3 py-2"><span className="text-blue-600">POST</span></td>
                      <td className="px-3 py-2 text-gray-600">点赞/收藏</td>
                      <td className="px-3 py-2 text-gray-400">是</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">/api/user/profile</td>
                      <td className="px-3 py-2"><span className="text-green-600">GET</span></td>
                      <td className="px-3 py-2 text-gray-600">获取个人资料</td>
                      <td className="px-3 py-2 text-gray-400">是</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">/api/user/likes</td>
                      <td className="px-3 py-2"><span className="text-green-600">GET</span></td>
                      <td className="px-3 py-2 text-gray-600">获取点赞列表</td>
                      <td className="px-3 py-2 text-gray-400">是</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">/api/stats</td>
                      <td className="px-3 py-2"><span className="text-green-600">GET</span></td>
                      <td className="px-3 py-2 text-gray-600">获取站点统计</td>
                      <td className="px-3 py-2 text-gray-400">否</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">/api/github/search</td>
                      <td className="px-3 py-2"><span className="text-green-600">GET</span></td>
                      <td className="px-3 py-2 text-gray-600">搜索代码仓库文件</td>
                      <td className="px-3 py-2 text-gray-400">否</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">/api/github/file</td>
                      <td className="px-3 py-2"><span className="text-green-600">GET</span></td>
                      <td className="px-3 py-2 text-gray-600">获取代码仓库文件内容</td>
                      <td className="px-3 py-2 text-gray-400">否</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                鉴权方式：在请求头中添加 <code className="px-1 py-0.5 bg-gray-100 rounded text-gray-600">Authorization: Bearer &lt;token&gt;</code>
              </p>
            </div>
          </section>

          {/* 常见问题 */}
          <section id="faq" className="scroll-mt-20">
            <h2 className="text-xl font-bold text-gray-900 mb-4">❓ 常见问题</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-1">如何修改头像？</h3>
                <p className="text-sm text-gray-600">
                  进入个人中心 → 编辑资料 → 头像区域，可输入图片 URL 或选择 Emoji 作为头像。
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-1">帖子支持什么格式？</h3>
                <p className="text-sm text-gray-600">
                  帖子内容支持 Markdown 格式，包括标题、列表、代码块、链接、图片等。
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-1">评论为什么没有立即显示？</h3>
                <p className="text-sm text-gray-600">
                  评论包含敏感词时会进入待审核状态，需管理员审核通过后才会显示。
                  正常评论会立即显示。
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-1">忘记密码怎么办？</h3>
                <p className="text-sm text-gray-600">
                  如果绑定了第三方登录账号，可通过对应账号登录。
                  其他情况请联系管理员重置密码。
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-1">用量监控数据是实时的吗？</h3>
                <p className="text-sm text-gray-600">
                  是的。平台通过全局中间件实时追踪每次请求，数据会记录到数据库中。
                  监控页面每 60 秒自动刷新一次。
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-1">如何在帖子中嵌入代码仓库文件？</h3>
                <p className="text-sm text-gray-600">
                  发帖时点击编辑器上方的「代码引用」按钮搜索开源代码，或手动使用
                  <code className="px-1 py-0.5 bg-gray-100 rounded text-gray-600 mx-1">```github-code</code>
                  代码块格式嵌入。详见上方「代码仓库文件嵌入」章节。
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Container>
  );
}
