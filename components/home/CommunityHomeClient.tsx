"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Container } from "@/components/common/Container";
import { cn } from "@/lib/utils";
import UserAvatar from "@/components/common/UserAvatar";
import OnlineCounter from "@/components/common/OnlineCounter";
import CheckInLeaderboard from "./CheckInLeaderboard";

interface CommunityPost {
  id: string;
  title: string;
  summary?: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isEssence: boolean;
  timeAgo: string;
  author: { id: string; username: string; avatar: string | null };
  category: { id: string; name: string; slug: string } | null;
}

interface ActiveMember {
  id: string;
  username: string;
  avatar: string | null;
  bio: string;
  postCount: number;
  commentCount: number;
}

interface CollabProject {
  id: string;
  title: string;
  summary: string;
  repoOwner: string;
  repoName: string;
  status: string;
  techStack: string[];
  tags: string[];
  memberCount: number;
  maxMembers: number;
  taskCount: number;
  completedTaskCount: number;
  contributionCount: number;
  timeAgo: string;
  author: { id: string; username: string; avatar: string | null };
}

interface CommunityData {
  latestPosts: CommunityPost[];
  hotPosts: CommunityPost[];
  activeMembers: ActiveMember[];
  collabProjects: CollabProject[];
  featuredTools: FeaturedTool[];
  stats: {
    userCount: number;
    postCount: number;
    commentCount: number;
    todayPostCount: number;
  };
}

interface FeaturedTool {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  toolType: string;
  clickCount: number;
}

function isImageUrl(value?: string | null) {
  if (!value) return false;
  return /^(https?:\/\/|\/|data:image\/)/i.test(value.trim());
}

function FeaturedToolIcon({ tool }: { tool: FeaturedTool }) {
  if (isImageUrl(tool.icon)) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tool.icon}
          alt={tool.name}
          className="h-full w-full object-cover"
          onError={(e) => {
            const img = e.currentTarget;
            img.style.display = "none";
            const fallback = img.nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.display = "inline";
          }}
        />
        <span className="hidden">🔧</span>
      </>
    );
  }

  return <span>{tool.icon || "🔧"}</span>;
}

interface CommunityHomeProps {
  siteName: string;
  siteDesc: string;
}

// 数字滚动动画
function CountUp({ end, duration = 1800, suffix = "" }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
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

// 帖子卡片（用于最新帖子和热门帖子）
function PostCard({ post, rank }: { post: CommunityPost; rank?: number }) {
  return (
    <Link
      href={`/forum/post/${post.id}`}
      className="group block bg-white rounded-xl border border-gray-200 p-4 transition-all duration-200 hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-3">
        {/* 排名标记（热门帖子用） */}
        {rank !== undefined && (
          <div className={cn(
            "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold",
            rank === 0 ? "bg-red-100 text-red-600" :
            rank === 1 ? "bg-orange-100 text-orange-600" :
            rank === 2 ? "bg-yellow-100 text-yellow-600" :
            "bg-gray-100 text-gray-500"
          )}>
            {rank + 1}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* 标签行 */}
          <div className="flex items-center gap-1.5 mb-1.5">
            {post.category && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                {post.category.name}
              </span>
            )}
            {post.isPinned && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-600 border border-red-200">
                📌 置顶
              </span>
            )}
            {post.isEssence && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                ⭐ 精华
              </span>
            )}
          </div>

          {/* 标题 */}
          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1 mb-1">
            {post.title}
          </h3>

          {/* 摘要（仅最新帖子显示） */}
          {post.summary && (
            <p className="text-xs text-gray-500 line-clamp-1 mb-2">{post.summary}</p>
          )}

          {/* 底部信息 */}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <UserAvatar username={post.author.username} avatar={post.author.avatar} size="sm" />
              <span className="text-gray-600">{post.author.username}</span>
            </div>
            <span>{post.timeAgo}</span>
            <span className="flex items-center gap-0.5">👁 {post.viewCount}</span>
            <span className="flex items-center gap-0.5">💬 {post.commentCount}</span>
            <span className="flex items-center gap-0.5">❤️ {post.likeCount}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// 协作召集令卡片
function CollabProjectCard({ project }: { project: CollabProject }) {
  const techStack = project.techStack.slice(0, 3);
  const extraTech = Math.max(project.techStack.length - 3, 0);

  return (
    <Link
      href={`/collab/${project.id}`}
      className="group block bg-white rounded-xl border border-gray-200 p-4 transition-all duration-200 hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-600"
    >
      {/* 顶部：标题 + 状态徽章 */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1 dark:text-gray-100">
          {project.title}
        </h3>
        {project.status === "recruiting" ? (
          <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
            招募中
          </span>
        ) : (
          <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
            进行中
          </span>
        )}
      </div>

      {/* 描述摘要 */}
      <p className="text-xs text-gray-500 line-clamp-1 mb-2 dark:text-gray-400">
        {project.summary}
      </p>

      {/* 仓库信息 */}
      <div className="flex items-center gap-1 text-xs text-gray-400 mb-2 dark:text-gray-500">
        <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
        <span className="truncate">{project.repoOwner}/{project.repoName}</span>
      </div>

      {/* 技术栈标签 */}
      {techStack.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-2">
          {techStack.map((tech) => (
            <span
              key={tech}
              className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >
              {tech}
            </span>
          ))}
          {extraTech > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">+{extraTech}</span>
          )}
        </div>
      )}

      {/* 底部统计行 */}
      <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mb-2">
        <span className="flex items-center gap-0.5" title="成员数">👥 {project.memberCount}/{project.maxMembers}</span>
        <span className="flex items-center gap-0.5" title="任务完成">✅ {project.completedTaskCount}/{project.taskCount}</span>
        <span className="flex items-center gap-0.5" title="贡献数">📝 {project.contributionCount}</span>
      </div>

      {/* 发起人 */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
        <UserAvatar username={project.author.username} avatar={project.author.avatar} size="sm" />
        <span className="text-gray-600 dark:text-gray-400">{project.author.username}</span>
        <span>{project.timeAgo}</span>
      </div>
    </Link>
  );
}

export default function CommunityHomeClient({ siteName, siteDesc }: CommunityHomeProps) {
  const [data, setData] = useState<CommunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const forumRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch("/api/community/home", { cache: 'no-store', signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setLoadError(true);
        setLoading(false);
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const stats = data?.stats ?? { userCount: 0, postCount: 0, commentCount: 0, todayPostCount: 0 };

  return (
    <div className="min-h-screen bg-white">
      {/* ============ 1. Hero 社区横幅 ============ */}
      <section className="relative overflow-hidden bg-slate-900 text-white">
        {/* 渐变背景 */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900" />
        {/* 网格纹理 */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:56px_56px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,black,transparent)]" />
        {/* 光效 */}
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-500/30 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-purple-500/20 blur-3xl" />

        <Container className="relative py-24 text-center md:py-32">
          {/* 活跃状态徽标 */}
          <div className="mb-7 inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-blue-100 backdrop-blur sm:gap-2 sm:px-4 sm:text-sm">
            <OnlineCounter variant="hero" />
            <span className="text-white/30">·</span>
            <span>社区活跃中</span>
            <span className="hidden sm:inline text-white/30">·</span>
            <span className="hidden sm:inline whitespace-nowrap">今日新增 {stats.todayPostCount} 篇帖子</span>
          </div>

          {/* 主标题 */}
          <h1 className="mb-5 bg-gradient-to-r from-white via-blue-100 to-blue-300 bg-clip-text text-4xl font-bold text-transparent md:text-6xl lg:text-7xl">
            {siteName}
          </h1>

          {/* 副标题 - 社区定位 */}
          <p className="mb-4 text-xl font-medium text-blue-100 md:text-2xl">
            开发者交流、分享、成长的社区
          </p>
          <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-blue-200/80 md:text-lg">
            连接开发者，共建 AI 工具生态。在这里分享经验、讨论技术、一起成长。
          </p>

          {/* CTA 按钮 */}
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/forum"
              className="group inline-flex items-center justify-center rounded-xl bg-white px-8 py-3.5 font-semibold text-blue-700 shadow-lg shadow-blue-900/30 transition-all hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-xl"
            >
              加入社区
              <svg className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </Link>
            <Link
              href="/collab"
              className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/5 px-8 py-3.5 font-semibold text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/15"
            >
              协同创作
            </Link>
          </div>

          {/* Hero 内联统计 */}
          <div className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 backdrop-blur">
              <div className="text-3xl font-bold text-white">
                {stats.userCount.toLocaleString()}<span className="text-blue-300">+</span>
              </div>
              <div className="mt-1 text-sm text-blue-200">社区成员</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 backdrop-blur">
              <div className="text-3xl font-bold text-white">
                {stats.postCount.toLocaleString()}<span className="text-blue-300">+</span>
              </div>
              <div className="mt-1 text-sm text-blue-200">讨论帖子</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 backdrop-blur">
              <div className="text-3xl font-bold text-white">
                {stats.commentCount.toLocaleString()}<span className="text-blue-300">+</span>
              </div>
              <div className="mt-1 text-sm text-blue-200">社区评论</div>
            </div>
          </div>
        </Container>
      </section>

      {/* ============ 2. 社区动态区 ============ */}
      <section ref={forumRef} className="bg-gray-50 py-16 md:py-20">
        <Container>
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-blue-300" />
            <span className="text-sm font-medium uppercase tracking-widest text-blue-500">Community</span>
            <span className="h-px w-8 bg-blue-300" />
          </div>
          <h2 className="mb-3 text-center text-3xl font-bold text-gray-900 md:text-4xl">
            社区动态
          </h2>
          <p className="mb-12 text-center text-gray-500">
            看看大家最近在讨论什么
          </p>

          {loading ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-3" />
                    <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-gray-100 rounded w-full" />
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-4 dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className="h-4 bg-gray-200 rounded w-2/3 dark:bg-gray-700" />
                      <div className="h-4 bg-gray-200 rounded w-12 dark:bg-gray-700" />
                    </div>
                    <div className="h-3 bg-gray-100 rounded w-full mb-2 dark:bg-gray-700" />
                    <div className="h-3 bg-gray-100 rounded w-1/2 mb-2 dark:bg-gray-700" />
                    <div className="h-3 bg-gray-100 rounded w-2/3 dark:bg-gray-700" />
                  </div>
                ))}
              </div>
            </div>
          ) : loadError ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">😵</p>
              <p className="text-gray-500 mb-4">数据加载超时，请检查网络后重试</p>
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                重新加载
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* 左侧：最新帖子 */}
              <div className="lg:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                    <span>🆕</span> 最新发布
                  </h3>
                  <Link href="/forum" className="text-sm text-blue-600 hover:text-blue-700 transition-colors">
                    查看全部 →
                  </Link>
                </div>
                <div className="space-y-3">
                  {data?.latestPosts.length ? (
                    data.latestPosts.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <p className="text-4xl mb-3">📭</p>
                      <p>还没有帖子，快来抢沙发吧~</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧：协同创作召集令 */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
                    <span>🐙</span> 协同创作召集令
                  </h3>
                  <Link href="/collab" className="text-sm text-blue-600 hover:text-blue-700 transition-colors dark:text-blue-400 dark:hover:text-blue-300">
                    查看全部 →
                  </Link>
                </div>
                <div className="space-y-3">
                  {(data?.collabProjects ?? []).length ? (
                    (data?.collabProjects ?? []).map((project) => (
                      <CollabProjectCard key={project.id} project={project} />
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                      <p className="text-4xl mb-3">🚀</p>
                      <p className="mb-4">还没有协作项目，快来发起第一个召集令吧！</p>
                      <Link
                        href="/collab/new"
                        className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        发起召集令
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Container>
      </section>

      {/* ============ 3. 社区数据展示 ============ */}
      <section className="bg-white py-16 md:py-24">
        <Container>
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {[
              { label: "社区成员", value: stats.userCount, suffix: "+", icon: "👥", hint: "开发者社群" },
              { label: "讨论帖子", value: stats.postCount, suffix: "+", icon: "📝", hint: "经验沉淀" },
              { label: "社区评论", value: stats.commentCount, suffix: "+", icon: "💬", hint: "活跃交流" },
              { label: "今日新增", value: stats.todayPostCount, suffix: "", icon: "🆕", hint: "持续增长" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/50 p-8 text-center transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
              >
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-100/40 blur-2xl transition-opacity group-hover:opacity-100" />
                <div className="relative">
                  <div className="mb-3 text-4xl">{stat.icon}</div>
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
                    <CountUp end={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="mt-2 text-base font-medium text-gray-800">{stat.label}</div>
                  <div className="mt-1 text-xs text-gray-400">{stat.hint}</div>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ============ 4. 活跃成员展示 ============ */}
      {data && data.activeMembers.length > 0 && (
        <section className="bg-gray-50 py-16 md:py-20">
          <Container>
            <div className="mb-4 flex items-center justify-center gap-2">
              <span className="h-px w-8 bg-blue-300" />
              <span className="text-sm font-medium uppercase tracking-widest text-blue-500">Members</span>
              <span className="h-px w-8 bg-blue-300" />
            </div>
            <h2 className="mb-3 text-center text-3xl font-bold text-gray-900 md:text-4xl">
              活跃成员
            </h2>
            <p className="mb-12 text-center text-gray-500">
              感谢每一位为社区贡献的开发者
            </p>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {data.activeMembers.map((member) => (
                <Link
                  key={member.id}
                  href={`/profile`}
                  className="group flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-6 text-center transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
                >
                  <UserAvatar username={member.username} avatar={member.avatar} size="lg" />
                  <h3 className="mt-3 text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {member.username}
                  </h3>
                  {member.bio && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-1">{member.bio}</p>
                  )}
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                    <span>📝 {member.postCount}</span>
                    <span>💬 {member.commentCount}</span>
                  </div>
                </Link>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* ============ 4.5 签到 & 排行榜 ============ */}
      <CheckInLeaderboard />

      {/* ============ 5. 入口引导区 ============ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 py-16 text-white md:py-24">
        <div className="absolute -left-20 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -right-20 top-0 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />

        <Container className="relative">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              参与社区，从这里开始
            </h2>
            <p className="mx-auto max-w-xl text-lg text-blue-100/80">
              无论你是想分享经验、提问求助，还是寻找工具，这里都有你的一席之地
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* 浏览论坛 */}
            <Link
              href="/forum"
              className="group rounded-2xl border border-white/15 bg-white/10 p-8 backdrop-blur transition-all hover:-translate-y-1 hover:bg-white/15"
            >
              <div className="mb-4 text-4xl">💬</div>
              <h3 className="mb-2 text-xl font-bold">浏览论坛</h3>
              <p className="text-sm text-blue-100/80">
                浏览社区帖子，参与讨论，发现有趣的内容和观点
              </p>
              <span className="mt-4 inline-flex items-center text-sm font-medium text-blue-300 group-hover:text-blue-200 transition-colors">
                进入论坛
                <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>

            {/* 发布帖子 */}
            <Link
              href="/forum/new"
              className="group rounded-2xl border border-white/15 bg-white/10 p-8 backdrop-blur transition-all hover:-translate-y-1 hover:bg-white/15"
            >
              <div className="mb-4 text-4xl">✏️</div>
              <h3 className="mb-2 text-xl font-bold">发布帖子</h3>
              <p className="text-sm text-blue-100/80">
                分享你的经验、提出问题、发起讨论，让更多人看到你的想法
              </p>
              <span className="mt-4 inline-flex items-center text-sm font-medium text-blue-300 group-hover:text-blue-200 transition-colors">
                开始写作
                <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>

            {/* 协同创作 */}
            <Link
              href="/collab"
              className="group rounded-2xl border border-white/15 bg-white/10 p-8 backdrop-blur transition-all hover:-translate-y-1 hover:bg-white/15"
            >
              <div className="mb-4 text-4xl">🚀</div>
              <h3 className="mb-2 text-xl font-bold">协同创作</h3>
              <p className="text-sm text-blue-100/80">
                发起 GitHub 协作项目，邀请开发者一起写代码
              </p>
              <span className="mt-4 inline-flex items-center text-sm font-medium text-blue-300 group-hover:text-blue-200 transition-colors">
                发起召集令
                <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          </div>
        </Container>
      </section>

      {/* ============ 6. 工具展示区 ============ */}
      <section id="tools" className="bg-white py-16 md:py-20 border-t border-gray-100">
        <Container>
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-blue-300" />
            <span className="text-sm font-medium uppercase tracking-widest text-blue-500">Tools</span>
            <span className="h-px w-8 bg-blue-300" />
          </div>
          <h2 className="mb-3 text-center text-3xl font-bold text-gray-900 md:text-4xl">
            开发者工具
          </h2>
          <p className="mb-10 text-center text-gray-500">
            精选实用在线工具，即开即用
          </p>

          {(data?.featuredTools ?? []).length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(data?.featuredTools ?? []).slice(0, 6).map((tool) => (
                  <Link
                    key={tool.id}
                    href={`/tools/${tool.id}`}
                    className="group bg-white rounded-xl border border-gray-200 p-4 transition-all duration-200 hover:shadow-md hover:border-blue-300 hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/60 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                        <FeaturedToolIcon tool={tool} />
                      </div>
                      <h3 className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {tool.name}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed min-h-[2rem]">
                      {tool.description || '实用在线工具'}
                    </p>
                    <div className="mt-3 pt-2 border-t border-gray-50 flex items-center justify-between text-xs">
                      <span className="text-blue-600 font-medium">{tool.category}</span>
                      <span className="text-gray-400">
                        {tool.toolType === 'embedded' ? '🛠️ 在线' : '🔗 链接'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="flex justify-center mt-8">
                <Link
                  href="/tools"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
                >
                  查看全部工具
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </>
          ) : (
            <div className="flex justify-center">
              <Link
                href="/tools"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
              >
                🔧 浏览工具库
              </Link>
            </div>
          )}
        </Container>
      </section>
    </div>
  );
}
