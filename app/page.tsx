"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Container } from "@/components/common/Container";
import ToolCard from "@/components/home/ToolCard";
import toast from "react-hot-toast";

interface Tool {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: string;
  category: string;
}

interface CategoryItem {
  name: string;
  icon: string;
}

const CATEGORIES: CategoryItem[] = [
  { name: "全部", icon: "🎯" },
  { name: "代码工具", icon: "💻" },
  { name: "AI工具", icon: "🤖" },
  { name: "效率工具", icon: "⚡" },
];

interface FeatureItem {
  icon: string;
  title: string;
  desc: string;
  gradient: string;
}

const FEATURES: FeatureItem[] = [
  {
    icon: "⚡",
    title: "极速体验",
    desc: "无需安装，打开即用。所有工具在浏览器中运行，零等待、零配置，秒级响应。",
    gradient: "from-amber-50 to-orange-100",
  },
  {
    icon: "🔒",
    title: "安全可靠",
    desc: "代码本地处理，不上传服务器。你的数据始终在你手中，隐私安全有保障。",
    gradient: "from-emerald-50 to-teal-100",
  },
  {
    icon: "🆓",
    title: "完全免费",
    desc: "所有工具完全免费使用，无隐藏收费，无注册门槛，开放透明、持续迭代。",
    gradient: "from-blue-50 to-indigo-100",
  },
];

interface TechItem {
  name: string;
  icon: string;
}

const TECH_STACK: TechItem[] = [
  { name: "Next.js", icon: "▲" },
  { name: "TypeScript", icon: "TS" },
  { name: "Tailwind CSS", icon: "🎨" },
  { name: "Prisma", icon: "◈" },
  { name: "Zustand", icon: "🐻" },
  { name: "Vercel", icon: "▲" },
];

interface StatItem {
  label: string;
  value: number;
  suffix: string;
  icon: string;
  hint: string;
}

/**
 * 数字滚动动画组件
 * 进入视口后从 0 滚动到目标值，使用 IntersectionObserver + requestAnimationFrame。
 */
function CountUp({
  end,
  duration = 1800,
  suffix = "",
}: {
  end: number;
  duration?: number;
  suffix?: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // 已播放过动画：目标值变化时直接对齐，避免视觉跳变
    if (startedRef.current) {
      setCount(end);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            const startTime = performance.now();
            const animate = (now: number) => {
              const elapsed = now - startTime;
              const progress = Math.min(elapsed / duration, 1);
              // easeOutExpo 缓动
              const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
              setCount(Math.floor(eased * end));
              if (progress < 1) {
                requestAnimationFrame(animate);
              } else {
                setCount(end);
              }
            };
            requestAnimationFrame(animate);
          }
        });
      },
      { threshold: 0.3 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [end, duration]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function HomePage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("全部");
  const toolsRef = useRef<HTMLDivElement>(null);
  const [siteName, setSiteName] = useState("ET Studio");
  const [siteDesc, setSiteDesc] = useState("实用开发工具，让效率翻倍");

  useEffect(() => {
    fetchTools();
    // 动态获取网站名称和描述
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data?.site_name) setSiteName(data.site_name);
        if (data?.site_description) setSiteDesc(data.site_description);
      })
      .catch(() => {});
  }, []);

  async function fetchTools() {
    try {
      setLoading(true);
      const res = await fetch("/api/tools");
      if (!res.ok) throw new Error("获取工具列表失败");
      const data = await res.json();
      setTools(data);
    } catch {
      toast.error("获取工具列表失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  const filteredTools =
    activeCategory === "全部"
      ? tools
      : tools.filter((t) => t.category === activeCategory);

  function scrollToTools() {
    toolsRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  // 数据统计区域（工具数取真实值，其余为占位数字）
  const STATS: StatItem[] = [
    { label: "工具总数", value: tools.length, suffix: "+", icon: "🛠️", hint: "持续更新中" },
    { label: "注册用户", value: 1280, suffix: "+", icon: "👥", hint: "开发者社群" },
    { label: "社区帖子", value: 860, suffix: "+", icon: "💬", hint: "经验沉淀" },
    { label: "累计访问", value: 52000, suffix: "+", icon: "🌐", hint: "覆盖全球" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* ============ Hero 区域 ============ */}
      <section className="relative overflow-hidden bg-slate-900 text-white">
        {/* 渐变背景 */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900" />
        {/* 网格纹理 */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:56px_56px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,black,transparent)]" />
        {/* 光效装饰 */}
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-500/30 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-purple-500/20 blur-3xl" />

        <Container className="relative py-24 text-center md:py-36">
          {/* 状态徽标 */}
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-blue-100 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            全新上线 · 持续更新中
          </div>

          {/* 标题（渐变文字） */}
          <h1 className="mb-5 bg-gradient-to-r from-white via-blue-100 to-blue-300 bg-clip-text text-4xl font-bold text-transparent md:text-6xl lg:text-7xl">
            {siteName}
          </h1>

          <p className="mb-4 text-xl font-medium text-blue-100 md:text-2xl">
            {siteDesc}
          </p>
          <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-blue-200/80 md:text-lg">
            为开发者提供简洁高效的在线工具，从代码处理到 AI 辅助，一站搞定，
            让效率真正翻倍。
          </p>

          {/* CTA 按钮组 */}
          <div className="mb-14 flex flex-col justify-center gap-4 sm:flex-row">
            <button
              onClick={scrollToTools}
              className="group inline-flex items-center justify-center rounded-xl bg-white px-8 py-3.5 font-semibold text-blue-700 shadow-lg shadow-blue-900/30 transition-all hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-xl hover:shadow-blue-900/40"
            >
              浏览工具
              <svg
                className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5-5 5M6 12h12"
                />
              </svg>
            </button>
            <Link
              href="/forum"
              className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/5 px-8 py-3.5 font-semibold text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/15"
            >
              加入社区
            </Link>
          </div>

          {/* Hero 内联统计 */}
          <div className="mx-auto grid max-w-2xl grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 backdrop-blur">
              <div className="text-3xl font-bold text-white">
                {tools.length}
                <span className="text-blue-300">+</span>
              </div>
              <div className="mt-1 text-sm text-blue-200">在线工具</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 backdrop-blur">
              <div className="text-3xl font-bold text-white">
                1,280<span className="text-blue-300">+</span>
              </div>
              <div className="mt-1 text-sm text-blue-200">注册用户</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 backdrop-blur">
              <div className="text-3xl font-bold text-white">
                860<span className="text-blue-300">+</span>
              </div>
              <div className="mt-1 text-sm text-blue-200">社区帖子</div>
            </div>
          </div>
        </Container>
      </section>

      {/* ============ 工具展示区域 ============ */}
      <section id="tools" ref={toolsRef} className="bg-gray-50 py-16 md:py-20">
        <Container>
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-blue-300" />
            <span className="text-sm font-medium uppercase tracking-widest text-blue-500">
              Tools
            </span>
            <span className="h-px w-8 bg-blue-300" />
          </div>
          <h2 className="mb-3 text-center text-3xl font-bold text-gray-900 md:text-4xl">
            工具列表
          </h2>
          <p className="mb-10 text-center text-gray-500">
            精心打造的在线工具，助力你的开发工作流
          </p>

          {/* 分类筛选标签（胶囊式带图标） */}
          <div className="mb-12 flex flex-wrap justify-center gap-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
                  activeCategory === cat.name
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "border border-gray-200 bg-white text-gray-600 hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                <span className="text-base">{cat.icon}</span>
                {cat.name}
              </button>
            ))}
          </div>

          {/* Loading 状态 */}
          {loading && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl border border-gray-200 bg-white p-6"
                >
                  <div className="mb-4 h-12 w-12 rounded-lg bg-gray-200" />
                  <div className="mb-3 h-4 w-16 rounded bg-gray-200" />
                  <div className="mb-3 h-5 w-3/4 rounded bg-gray-200" />
                  <div className="mb-2 h-4 w-full rounded bg-gray-200" />
                  <div className="h-4 w-2/3 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          )}

          {/* 空状态（更优雅） */}
          {!loading && filteredTools.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="relative mb-6">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 text-5xl">
                  {activeCategory === "全部" ? "🚀" : "🔍"}
                </div>
                <div className="absolute inset-0 -z-10 rounded-full bg-blue-200/40 blur-xl" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-800">
                {activeCategory === "全部" ? "工具正在路上" : "未找到匹配工具"}
              </h3>
              <p className="max-w-sm text-gray-500">
                {activeCategory === "全部"
                  ? "我们正在精心打磨更多实用工具，敬请期待。"
                  : `「${activeCategory}」分类下暂时还没有工具，试试其他分类吧。`}
              </p>
            </div>
          )}

          {/* 工具卡片网格（hover 上浮阴影由 ToolCard 自身实现） */}
          {!loading && filteredTools.length > 0 && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredTools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* ============ 数据统计区域（数字滚动动画） ============ */}
      <section className="bg-white py-16 md:py-24">
        <Container>
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/50 p-8 text-center transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
              >
                {/* 背景光晕 */}
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-100/40 blur-2xl transition-opacity group-hover:opacity-100" />
                <div className="relative">
                  <div className="mb-3 text-4xl">{stat.icon}</div>
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
                    <CountUp end={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="mt-2 text-base font-medium text-gray-800">
                    {stat.label}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">{stat.hint}</div>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ============ 特性卡片区域（渐变边框 + 图标背景色） ============ */}
      <section className="bg-gray-50 py-16 md:py-24">
        <Container>
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-blue-300" />
            <span className="text-sm font-medium uppercase tracking-widest text-blue-500">
              Features
            </span>
            <span className="h-px w-8 bg-blue-300" />
          </div>
          <h2 className="mb-3 text-center text-3xl font-bold text-gray-900 md:text-4xl">
            为什么选择我们
          </h2>
          <p className="mb-12 text-center text-gray-500">
            以开发者为中心，专注体验、安全与开放
          </p>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 p-[1.5px] transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/20"
              >
                <div className="h-full rounded-2xl bg-white p-8 text-center">
                  <div
                    className={`mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient} text-4xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="mb-2 text-xl font-bold text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="leading-relaxed text-gray-500">
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ============ 社区 CTA 区域（双列布局） ============ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 py-16 text-white md:py-24">
        {/* 装饰光效 */}
        <div className="absolute -left-20 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -right-20 top-0 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />

        <Container className="relative">
          <div className="grid items-center gap-12 md:grid-cols-2">
            {/* 左侧文字 */}
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-blue-100 backdrop-blur">
                💬 开发者社区
              </div>
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">
                有想法？加入我们的社区
              </h2>
              <p className="mb-6 max-w-md text-lg leading-relaxed text-blue-100/80">
                与其他开发者交流经验，分享工具使用心得，一起探索更高效的开发方式。
              </p>
              <ul className="mb-8 space-y-3">
                {["实时交流开发经验", "分享工具使用心得", "参与产品共建讨论"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-3 text-blue-100">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-400/20 text-sm text-green-300">
                        ✓
                      </span>
                      {item}
                    </li>
                  )
                )}
              </ul>
              <Link
                href="/forum"
                className="group inline-flex items-center rounded-xl bg-white px-8 py-3.5 font-semibold text-blue-700 transition-all hover:-translate-y-0.5 hover:bg-blue-50"
              >
                前往社区
                <svg
                  className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5-5 5M6 12h12"
                  />
                </svg>
              </Link>
            </div>

            {/* 右侧装饰图（CSS 组合，无外部资源） */}
            <div className="relative">
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-2xl" />
              <div className="relative rounded-3xl border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/30 text-lg">
                      👨‍💻
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-white/15 px-4 py-2.5 text-sm text-white">
                      这个代码格式化工具太方便了！
                    </div>
                  </div>
                  <div className="flex items-start justify-end gap-3">
                    <div className="rounded-2xl rounded-tr-sm bg-blue-500/50 px-4 py-2.5 text-sm text-white">
                      对，分享我的使用心得 ✨
                    </div>
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/30 text-lg">
                      🧑‍💻
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/30 text-lg">
                      👩‍💻
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-white/15 px-4 py-2.5 text-sm text-white">
                      期待更多 AI 工具上线 🚀
                    </div>
                  </div>
                </div>
              </div>
              {/* 浮动徽标 */}
              <div className="absolute -right-4 -top-4 flex h-14 w-14 animate-bounce items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-2xl backdrop-blur" style={{ animationDuration: "3s" }}>
                💬
              </div>
              <div className="absolute -bottom-4 -left-4 flex h-14 w-14 animate-bounce items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-2xl backdrop-blur" style={{ animationDuration: "3.5s" }}>
                🚀
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ============ 合作伙伴 / 技术栈展示 ============ */}
      <section className="border-t border-gray-100 bg-white py-14">
        <Container>
          <p className="mb-8 text-center text-sm font-medium uppercase tracking-widest text-gray-400">
            技术栈与合作伙伴
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            {TECH_STACK.map((tech) => (
              <div
                key={tech.name}
                className="group flex items-center gap-2 opacity-60 transition-all hover:-translate-y-0.5 hover:opacity-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 text-sm font-bold text-gray-600 transition-colors group-hover:from-blue-50 group-hover:to-indigo-100 group-hover:text-blue-600">
                  {tech.icon}
                </span>
                <span className="text-base font-medium text-gray-500 transition-colors group-hover:text-gray-900">
                  {tech.name}
                </span>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </div>
  );
}
