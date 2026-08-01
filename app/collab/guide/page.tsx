"use client";

import { useState, ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/common/Container";

// ============ 教程章节 ============
const SECTIONS = [
  { id: "overview", title: "功能介绍", icon: "📋" },
  { id: "create", title: "发起召集令", icon: "🚀" },
  { id: "join", title: "加入项目", icon: "🤝" },
  { id: "tasks", title: "任务管理", icon: "📝" },
  { id: "contribute", title: "提交贡献", icon: "📤" },
  { id: "review", title: "审核流程", icon: "✅" },
  { id: "norms", title: "协作规范", icon: "📐" },
  { id: "github", title: "GitHub 集成", icon: "🐙" },
  { id: "roles", title: "角色与权限", icon: "👥" },
  { id: "faq", title: "常见问题", icon: "❓" },
];

// 代码块组件
function CodeBlock({ children }: { children: string }) {
  return (
    <div className="bg-gray-900 dark:bg-gray-800 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto my-3">
      <pre className="whitespace-pre-wrap break-all">{children}</pre>
    </div>
  );
}

// 步骤组件
function Step({ num, title, children }: { num: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">
        {num}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h4>
        <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

// 提示框组件
function Callout({ type = "info", title, children }: { type?: "info" | "warning" | "tip"; title?: string; children: ReactNode }) {
  const styles = {
    info: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
    warning: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300",
    tip: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300",
  };
  const icons = { info: "💡", warning: "⚠️", tip: "✨" };
  return (
    <div className={`rounded-xl border p-4 my-4 ${styles[type]}`}>
      <div className="flex items-start gap-2">
        <span className="text-lg flex-shrink-0">{icons[type]}</span>
        <div className="flex-1 text-sm">
          {title && <p className="font-semibold mb-1">{title}</p>}
          <div className="leading-relaxed opacity-90">{children}</div>
        </div>
      </div>
    </div>
  );
}

// 表格组件
function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 徽章组件
function Badge({ color, children }: { color: string; children: ReactNode }) {
  const colors: Record<string, string> = {
    green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    gray: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
}

export default function CollabGuidePage() {
  const [activeSection, setActiveSection] = useState("overview");

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero 区域 */}
      <section className="relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:56px_56px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,black,transparent)]" />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-blue-500/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-indigo-500/30 blur-3xl" />

        <Container className="relative py-16 md:py-24">
          <Link href="/collab" className="inline-flex items-center gap-2 text-sm text-blue-200 hover:text-white transition-colors mb-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回召集令列表
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-blue-100 backdrop-blur mb-6">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            完整使用教程
          </div>

          <h1 className="mb-4 bg-gradient-to-r from-white via-blue-100 to-blue-300 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
            🐙 GitHub 协同创作召集令
          </h1>
          <p className="text-xl text-blue-100 mb-3">使用教程 & 完全指南</p>
          <p className="max-w-2xl text-base leading-relaxed text-blue-200/80">
            从发起召集令到团队协作开发，手把手教你使用平台的 GitHub 协同创作功能。
            创建项目仓库、邀请开发者、管理任务清单、提交代码贡献，一站式完成开源协作。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/collab/new"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-blue-700 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-blue-50"
            >
              🚀 立即发起召集令
            </Link>
            <Link
              href="/collab"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/5 px-6 py-3 font-semibold text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/15"
            >
              浏览召集令
            </Link>
          </div>
        </Container>
      </section>

      {/* 主体内容 */}
      <Container className="py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* 左侧目录 */}
          <aside className="w-full lg:w-60 flex-shrink-0">
            <nav className="lg:sticky lg:top-20 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3">
              <p className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">目录</p>
              <ul className="space-y-1">
                {SECTIONS.map((section) => (
                  <li key={section.id}>
                    <button
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                        activeSection === section.id
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
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
            {/* ========== 1. 功能介绍 ========== */}
            <section id="overview" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">📋 功能介绍</h2>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  <strong className="text-gray-900 dark:text-gray-100">GitHub 协同创作召集令</strong> 是平台的核心功能之一，
                  旨在帮助开发者发起开源协作项目，邀请社区成员共同参与代码编写和项目开发。
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  你可以将其理解为一个「开源项目招募板」—— 发布项目需求，吸引开发者加入，
                  通过任务分配、贡献提交、代码审核等机制，有序地完成项目开发。
                </p>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4">核心能力</h3>
                <Table
                  headers={["功能", "说明"]}
                  rows={[
                    ["发起召集令", "创建项目页面，关联 GitHub 仓库，描述项目目标和参与要求"],
                    ["两种仓库来源", "手动添加已有 GitHub 仓库，或登录 GitHub 后直接创建新仓库"],
                    ["任务清单", "创建开发任务，分配给团队成员，跟踪任务状态流转"],
                    ["提交贡献", "记录 commit、PR、issue 等代码贡献，关联任务和分支"],
                    ["审核机制", "项目管理者审核贡献，通过或拒绝提交"],
                    ["团队管理", "成员加入/离开，角色分为 owner、maintainer、member"],
                    ["GitHub 动态", "自动拉取仓库最近提交记录和贡献者统计"],
                  ]}
                />

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4">适用场景</h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 ml-4 list-disc">
                  <li>发起开源项目，寻找志同道合的开发者一起协作</li>
                  <li>组织黑客松或编程比赛，管理参赛队伍和任务</li>
                  <li>社区共建工具库、组件库、文档项目</li>
                  <li>教学场景：导师创建项目，学生认领任务并提交代码</li>
                </ul>
              </div>
            </section>

            {/* ========== 2. 发起召集令 ========== */}
            <section id="create" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">🚀 发起召集令</h2>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  登录后访问 <Link href="/collab/new" className="text-blue-600 dark:text-blue-400 underline">/collab/new</Link> 页面，
                  填写项目信息并关联 GitHub 仓库即可发起召集令。
                </p>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">方式一：手动添加已有仓库</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  如果你已经在 GitHub 上创建了仓库，直接输入仓库 URL 即可：
                </p>
                <CodeBlock>{`https://github.com/your-username/your-repo`}</CodeBlock>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  系统会自动解析 URL，提取仓库所有者和仓库名，并调用 GitHub API 获取仓库信息（描述、默认分支、语言、star 数等）进行预览展示。
                </p>

                <div className="space-y-4 mt-6">
                  <Step num={1} title="填写召集令标题">
                    给你的项目起一个吸引人的标题，例如「打造下一代 Markdown 编辑器」。标题长度 2-100 字。
                  </Step>
                  <Step num={2} title="编写项目描述">
                    用 Markdown 描述项目是做什么的、解决什么问题、预期成果。描述至少 10 个字符。
                  </Step>
                  <Step num={3} title="输入 GitHub 仓库 URL">
                    粘贴你的仓库链接，系统自动解析并显示仓库信息预览。
                  </Step>
                  <Step num={4} title="添加技术栈和标签">
                    输入技术栈（如 React、TypeScript、Node.js）和项目标签（如 Web、CLI、AI），按回车确认。方便其他开发者快速了解项目技术方向。
                  </Step>
                  <Step num={5} title="填写项目目标和参与要求（可选）">
                    项目目标用 Markdown 编写，说明项目的里程碑和预期成果。参与要求描述你希望加入的开发者具备什么技能或条件。
                  </Step>
                  <Step num={6} title="设置最大成员数">
                    默认 10 人，可设置 2-50 人。根据项目规模合理设置，避免人太多导致协调困难。
                  </Step>
                  <Step num={7} title="提交发布">
                    确认信息无误后点击「发起召集令」按钮，项目创建成功后自动跳转到详情页。
                  </Step>
                </div>

                <Callout type="tip" title="提示">
                  创建成功后，你将自动成为项目的 <strong>owner</strong>（所有者），拥有最高管理权限。
                </Callout>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-6">方式二：登录 GitHub 创建新仓库</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  如果你还没有创建仓库，可以在创建召集令的同时直接通过 GitHub API 创建新仓库：
                </p>
                <div className="space-y-4">
                  <Step num={1} title="切换到「创建新仓库」模式">
                    在仓库来源区域，点击「创建新仓库」选项卡。
                  </Step>
                  <Step num={2} title="填写仓库名称">
                    输入仓库名（只能包含字母、数字、连字符和下划线），例如 <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">my-awesome-project</code>。
                  </Step>
                  <Step num={3} title="填写仓库描述">
                    简短描述仓库用途，会同步到 GitHub。
                  </Step>
                  <Step num={4} title="选择是否私有">
                    公开仓库任何人可见，私有仓库仅协作者可见。建议开源项目选择公开。
                  </Step>
                  <Step num={5} title="是否初始化 README">
                    勾选后会自动创建 README.md 文件，方便后续直接开始开发。
                  </Step>
                  <Step num={6} title="创建仓库">
                    点击「创建仓库」按钮，系统调用 GitHub API 创建仓库。创建成功后自动填入仓库 URL。
                  </Step>
                </div>

                <Callout type="warning" title="注意">
                  方式二需要管理员在后台安全设置中配置 GitHub Token。如果未配置，会提示「GitHub Token 未配置」。
                  你也可以先在 GitHub 上手动创建仓库，然后使用方式一添加。
                </Callout>
              </div>
            </section>

            {/* ========== 3. 加入项目 ========== */}
            <section id="join" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">🤝 加入项目</h2>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  在召集令列表页 (<Link href="/collab" className="text-blue-600 dark:text-blue-400 underline">/collab</Link>)
                  浏览所有进行中的项目，找到感兴趣的项目后点击进入详情页。
                </p>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">加入条件</h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 ml-4 list-disc">
                  <li>项目状态为 <Badge color="green">招募中</Badge> 或 <Badge color="blue">进行中</Badge></li>
                  <li>当前成员数未达到最大成员数限制</li>
                  <li>你尚未加入该项目（不能重复加入）</li>
                  <li>需要登录账号</li>
                </ul>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4">加入流程</h3>
                <div className="space-y-4">
                  <Step num={1} title="浏览召集令列表">
                    在列表页使用筛选条件（状态、关键词）快速找到感兴趣的项目。
                  </Step>
                  <Step num={2} title="查看项目详情">
                    点击卡片进入详情页，阅读项目描述、目标、参与要求，确认是否适合自己。
                  </Step>
                  <Step num={3} title="点击「加入项目」">
                    在详情页顶部点击「加入项目」按钮，即可成为项目成员。
                  </Step>
                  <Step num={4} title="开始协作">
                    加入后可以认领任务、提交贡献、查看 GitHub 动态。
                  </Step>
                </div>

                <Callout type="info" title="离开项目">
                  成员可以随时离开项目（owner 除外）。离开后成员状态变为 <Badge color="gray">已离开</Badge>，
                  成员计数减一。之后可以重新加入。
                </Callout>
              </div>
            </section>

            {/* ========== 4. 任务管理 ========== */}
            <section id="tasks" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">📝 任务管理</h2>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  任务清单是协作开发的核心。通过任务分配，避免多人重复开发同一功能，确保团队有序推进。
                </p>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">任务状态流转</h3>
                <div className="flex flex-wrap items-center gap-2 my-4">
                  <Badge color="gray">待认领 (open)</Badge>
                  <span className="text-gray-400">→</span>
                  <Badge color="blue">进行中 (in_progress)</Badge>
                  <span className="text-gray-400">→</span>
                  <Badge color="orange">待审核 (review)</Badge>
                  <span className="text-gray-400">→</span>
                  <Badge color="green">已完成 (completed)</Badge>
                </div>

                <Table
                  headers={["状态", "含义", "可执行操作"]}
                  rows={[
                    ["待认领 (open)", "任务已创建，等待开发者认领", "认领任务 → 进行中"],
                    ["进行中 (in_progress)", "已有人认领，正在开发", "提交审核 → 待审核；退回 → 待认领"],
                    ["待审核 (review)", "代码已提交，等待审核", "审核通过 → 已完成；退回 → 进行中"],
                    ["已完成 (completed)", "任务完成，代码已合并", "归档，不再可操作"],
                    ["已取消 (cancelled)", "任务被取消或废弃", "归档，不再可操作"],
                  ]}
                />

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4">任务优先级</h3>
                <div className="flex flex-wrap gap-2 my-3">
                  <Badge color="red">紧急 (urgent)</Badge>
                  <Badge color="orange">高 (high)</Badge>
                  <Badge color="blue">中 (medium)</Badge>
                  <Badge color="gray">低 (low)</Badge>
                </div>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4">认领任务</h3>
                <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 ml-4 list-decimal">
                  <li>进入项目详情页，切换到「任务清单」Tab</li>
                  <li>找到状态为 <Badge color="gray">待认领</Badge> 的任务</li>
                  <li>点击「认领」按钮，任务指派人变为你的用户名</li>
                  <li>任务状态自动变为 <Badge color="blue">进行中</Badge></li>
                  <li>开发完成后，将状态改为 <Badge color="orange">待审核</Badge>，等待 owner/maintainer 审核</li>
                </ol>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4">创建任务（owner/maintainer）</h3>
                <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 ml-4 list-decimal">
                  <li>在任务清单 Tab 底部，点击「新建任务」</li>
                  <li>填写任务标题、描述（Markdown）、优先级</li>
                  <li>可选：设置截止日期、指派给特定成员、添加标签</li>
                  <li>提交后任务状态为 <Badge color="gray">待认领</Badge></li>
                </ol>

                <Callout type="tip" title="最佳实践">
                  任务粒度不要太粗也不要太细。一个任务最好能在 1-3 天内完成。
                  每个任务只负责一个功能点，避免一个大任务包含太多工作。
                </Callout>
              </div>
            </section>

            {/* ========== 5. 提交贡献 ========== */}
            <section id="contribute" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">📤 提交贡献</h2>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  当你在 GitHub 仓库中提交了代码（commit、PR、issue 等），可以在平台上记录这次贡献，
                  方便团队追踪每个人的贡献情况。
                </p>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">贡献类型</h3>
                <Table
                  headers={["类型", "图标", "说明"]}
                  rows={[
                    ["commit", "📦", "代码提交，关联 commit SHA"],
                    ["pull_request", "🔀", "Pull Request，关联 PR 链接"],
                    ["issue", "📌", "Issue 提交或回复"],
                    ["docs", "📄", "文档编写或更新"],
                    ["other", "🔧", "其他类型贡献"],
                  ]}
                />

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4">提交步骤</h3>
                <div className="space-y-4">
                  <Step num={1} title="切换到「提交贡献」Tab">
                    在项目详情页点击「提交贡献」标签页。
                  </Step>
                  <Step num={2} title="点击「提交贡献」按钮">
                    在贡献列表上方点击按钮，展开提交表单。
                  </Step>
                  <Step num={3} title="选择贡献类型">
                    选择 commit、PR、issue、docs 或 other。
                  </Step>
                  <Step num={4} title="填写贡献信息">
                    <ul className="ml-4 list-disc space-y-1 mt-2">
                      <li><strong>标题</strong>：简述这次贡献做了什么</li>
                      <li><strong>URL</strong>：GitHub commit/PR/issue 的链接</li>
                      <li><strong>Commit SHA</strong>：提交哈希（前 7 位），如 <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">a1b2c3d</code></li>
                      <li><strong>分支</strong>：提交所在分支名</li>
                      <li><strong>增删行数</strong>：新增和删除的代码行数</li>
                      <li><strong>关联任务</strong>：选择这次贡献对应的任务（可选）</li>
                    </ul>
                  </Step>
                  <Step num={5} title="提交">
                    点击提交后，贡献状态为 <Badge color="gray">待审核</Badge>，等待 owner/maintainer 审核。
                  </Step>
                </div>

                <Callout type="info" title="关联任务">
                  如果贡献关联了任务，在任务详情中也能看到该贡献记录。
                  建议每次提交贡献都关联对应的任务，方便追溯。
                </Callout>
              </div>
            </section>

            {/* ========== 6. 审核流程 ========== */}
            <section id="review" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">✅ 审核流程</h2>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  贡献审核是保证代码质量的关键环节。owner 和 maintainer 负责审核成员提交的贡献记录。
                </p>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">审核状态</h3>
                <div className="space-y-2 my-3">
                  <div className="flex items-center gap-3">
                    <Badge color="gray">待审核 (pending)</Badge>
                    <span className="text-sm text-gray-500 dark:text-gray-400">刚提交，等待审核</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge color="green">已通过 (approved)</Badge>
                    <span className="text-sm text-gray-500 dark:text-gray-400">审核通过，贡献已确认</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge color="red">已拒绝 (rejected)</Badge>
                    <span className="text-sm text-gray-500 dark:text-gray-400">审核未通过，需修改后重新提交</span>
                  </div>
                </div>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4">审核操作（owner/maintainer）</h3>
                <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 ml-4 list-decimal">
                  <li>进入「提交贡献」Tab，查看待审核的贡献</li>
                  <li>点击贡献右侧的「通过」或「拒绝」按钮</li>
                  <li>通过后贡献状态变为 <Badge color="green">已通过</Badge></li>
                  <li>拒绝后贡献状态变为 <Badge color="red">已拒绝</Badge>，提交者可修改后重新提交</li>
                </ol>

                <Callout type="warning" title="审核建议">
                  <ul className="space-y-1 mt-1">
                    <li>检查 commit 是否关联了正确的任务</li>
                    <li>确认代码是否通过 CI 自动检查</li>
                    <li>查看 PR 是否有冲突需要解决</li>
                    <li>代码风格是否符合项目规范</li>
                    <li>拒绝时给出具体修改建议，帮助贡献者改进</li>
                  </ul>
                </Callout>
              </div>
            </section>

            {/* ========== 7. 协作规范 ========== */}
            <section id="norms" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">📐 协作规范</h2>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  公共仓库的提交必须有序管理，否则会出现代码冲突、质量参差不齐、权限混乱的问题。
                  以下规范确保团队协作高效有序。
                </p>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">分支策略</h3>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">▸</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400"><strong>主分支（main）受保护</strong>，任何人都不能直接推送</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">▸</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">所有代码通过 <strong>Pull Request</strong> 提交</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">▸</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">管理员审核通过后才能合并到主分支</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">▸</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">审核时检查代码质量、是否包含敏感信息、是否破坏已有功能</p>
                  </div>
                </div>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4">代码规范</h3>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">▸</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">制定统一的代码风格指南（如 ESLint、Prettier 规则）</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">▸</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">每次提交必须通过 <strong>CI 自动检查</strong>（语法、格式、测试）</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">▸</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">审核不通过的 PR 退回修改，修改后重新提交</p>
                  </div>
                </div>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4">任务分配机制</h3>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-orange-500 mt-0.5">▸</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">任务需要有人认领，避免多人同时做同一件事</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-orange-500 mt-0.5">▸</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">任务状态清晰：待认领 → 进行中 → 待审核 → 已完成</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-orange-500 mt-0.5">▸</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">认领后需在指定时间内完成，超时可由 owner 释放任务</p>
                  </div>
                </div>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4">问题与解决方案</h3>
                <Table
                  headers={["问题", "解决方案"]}
                  rows={[
                    ["代码冲突", "主分支受保护，通过 PR 合并，确保每次合并都有审核"],
                    ["代码质量参差不齐", "CI 自动检查 + 管理员人工审核双重把关"],
                    ["任务重复认领", "任务状态管理，认领后锁定，避免重复工作"],
                    ["用户不知道怎么提交", "贡献指南 + 模板 PR 格式，降低参与门槛"],
                    ["不遵守规范", "CI 自动拦截不合规提交，多次违规者限制提交权限"],
                  ]}
                />

                <Callout type="tip" title="最佳实践">
                  GitHub 本身就是为协作模式设计的，<strong>PR + CI + 审核机制</strong>可以很好地管理公共仓库。
                  建议先从小范围邀请开始，验证流程可行性后再逐步开放。
                </Callout>
              </div>
            </section>

            {/* ========== 8. GitHub 集成 ========== */}
            <section id="github" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">🐙 GitHub 集成</h2>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  平台通过 GitHub API 实现了深度集成，包括仓库创建、信息获取、提交动态拉取等。
                </p>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">GitHub 动态 Tab</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  在项目详情页的「GitHub 动态」Tab 中，可以查看：
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 ml-4 list-disc">
                  <li><strong>最近提交</strong>：仓库最近 5 条 commit 记录，包括提交信息、作者、SHA 和时间</li>
                  <li><strong>贡献者统计</strong>：仓库的贡献者列表，包括提交次数和增删行数</li>
                  <li><strong>仓库概览</strong>：star 数、fork 数、open issues 数、默认分支、主要语言</li>
                </ul>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4">GitHub Token 配置</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  平台调用 GitHub API 需要 Token，配置方式：
                </p>
                <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 ml-4 list-decimal">
                  <li>登录 GitHub → Settings → Developer settings → Personal access tokens</li>
                  <li>创建 Fine-grained token，权限选择 <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">repo</code>（完整仓库访问）</li>
                  <li>在平台后台 → 安全设置 → GitHub Token 中粘贴保存</li>
                  <li>或设置环境变量 <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">GITHUB_TOKEN</code></li>
                </ol>

                <Callout type="warning" title="Token 权限说明">
                  <ul className="space-y-1 mt-1">
                    <li><strong>读取仓库信息</strong>：需要 <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">public_repo</code>（公开仓库）或 <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">repo</code>（全部仓库）</li>
                    <li><strong>创建新仓库</strong>：需要 <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">repo</code> 权限</li>
                    <li><strong>获取提交记录</strong>：需要仓库读取权限</li>
                    <li>建议使用 Fine-grained token，仅授权必要仓库和权限</li>
                  </ul>
                </Callout>
              </div>
            </section>

            {/* ========== 9. 角色与权限 ========== */}
            <section id="roles" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">👥 角色与权限</h2>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  项目中有三种角色，权限从高到低：
                </p>

                <Table
                  headers={["角色", "徽章颜色", "权限"]}
                  rows={[
                    ["Owner（所有者）", "紫色", "全部权限：创建/删除项目、管理成员、创建任务、审核贡献、更新项目信息"],
                    ["Maintainer（维护者）", "蓝色", "管理权限：创建/更新任务、审核贡献、更新项目信息"],
                    ["Member（成员）", "灰色", "基本权限：认领任务、提交贡献、查看项目动态"],
                  ]}
                />

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-4">权限对照表</h3>
                <Table
                  headers={["操作", "Owner", "Maintainer", "Member"]}
                  rows={[
                    ["查看项目", "✓", "✓", "✓"],
                    ["加入/离开项目", "✗（不可离开）", "✓", "✓"],
                    ["认领任务", "✓", "✓", "✓"],
                    ["提交贡献", "✓", "✓", "✓"],
                    ["创建任务", "✓", "✓", "✓"],
                    ["更新任务状态", "✓", "✓", "仅自己的任务"],
                    ["审核贡献", "✓", "✓", "✗"],
                    ["更新项目信息", "✓", "✓", "✗"],
                    ["删除项目", "✓", "✗", "✗"],
                  ]}
                />

                <Callout type="info" title="角色分配">
                  项目创建者自动成为 Owner。目前角色由 Owner 在数据库层面分配，
                  后续版本将支持在团队成员 Tab 中直接修改成员角色。
                </Callout>
              </div>
            </section>

            {/* ========== 10. 常见问题 ========== */}
            <section id="faq" className="scroll-mt-20">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">❓ 常见问题</h2>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Q: 创建召集令需要绑定 GitHub 账号吗？</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    不需要。使用「手动添加已有仓库」方式只需输入仓库 URL。但如果想通过平台创建新仓库，
                    则需要配置 GitHub Token。
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Q: 一个用户可以加入多少个项目？</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    没有限制。你可以加入任意多个项目，但建议专注于 1-3 个项目，保证开发质量。
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Q: Owner 可以离开自己的项目吗？</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    不可以。Owner 需要先将项目转让给其他成员（后续版本支持），或删除项目。
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Q: 贡献提交后多久能审核？</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    取决于 Owner/Maintainer 的活跃程度。建议在贡献描述中 @相关审核者，加快审核速度。
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Q: GitHub 动态 Tab 显示的数据是实时的吗？</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    是的。每次打开项目详情页时，系统会实时调用 GitHub API 获取最近 5 条提交和贡献者统计。
                    受 GitHub API 速率限制，频繁访问可能会有延迟。
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Q: 项目可以设为私有吗？</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    项目本身在平台上是公开的（所有用户可见）。但关联的 GitHub 仓库可以是私有的。
                    如果仓库是私有的，GitHub 动态 Tab 可能无法获取数据（取决于 Token 权限）。
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Q: 如何举报不遵守规范的项目？</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    可以在论坛发帖举报，或联系平台管理员。管理员有权关闭违规项目。
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Q: 任务认领后可以退回吗？</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    可以。将任务状态从「进行中」改回「待认领」即可释放任务，其他成员可以重新认领。
                  </p>
                </div>
              </div>
            </section>

            {/* 底部 CTA */}
            <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center text-white">
              <h3 className="text-2xl font-bold mb-3">准备好开始协作了吗？</h3>
              <p className="text-blue-100 mb-6 max-w-md mx-auto">
                发起你的第一个召集令，或加入一个正在进行的项目，开始你的开源协作之旅
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href="/collab/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-blue-700 shadow-lg transition-all hover:-translate-y-0.5"
                >
                  🚀 发起召集令
                </Link>
                <Link
                  href="/collab"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 font-semibold text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/20"
                >
                  浏览召集令
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
