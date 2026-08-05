"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getCategoryDisplayName } from "@/lib/utils";
import GitdLogo from "@/components/common/GitdLogo";

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

interface CollabProject {
  id: string;
  title: string;
  summary: string;
  repoOwner: string;
  repoName: string;
  status: string;
  techStack: string[];
  memberCount: number;
  maxMembers: number;
  taskCount: number;
  completedTaskCount: number;
  contributionCount: number;
  timeAgo: string;
  author: { id: string; username: string; avatar: string | null };
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

interface CommunityData {
  latestPosts: CommunityPost[];
  hotPosts: CommunityPost[];
  collabProjects: CollabProject[];
  featuredTools: FeaturedTool[];
  stats: {
    userCount: number;
    postCount: number;
    commentCount: number;
    todayPostCount: number;
  };
}

interface MobileHomeProps {
  siteName: string;
  siteDesc: string;
}

const EMPTY_POSTS: CommunityPost[] = [];
const EMPTY_PROJECTS: CollabProject[] = [];
const EMPTY_TOOLS: FeaturedTool[] = [];

function formatNumber(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return value.toLocaleString();
}

function uniquePosts(posts: CommunityPost[]) {
  const seen = new Set<string>();
  return posts.filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}

function getPostScore(post: CommunityPost) {
  return post.commentCount * 5 + post.likeCount * 3 + post.viewCount * 0.05 + (post.isEssence ? 20 : 0);
}

function getPostSource(post?: CommunityPost | null) {
  if (!post) return "社区精选";
  if (post.category) return getCategoryDisplayName(post.category.name, post.category.slug);
  if (post.isEssence) return "精选内容";
  if (post.isPinned) return "社区公告";
  return "社区讨论";
}

function ChannelCard({
  icon,
  title,
  desc,
  count,
  href,
  className = "bg-blue-600",
}: {
  icon: string;
  title: string;
  desc: string;
  count: number | string;
  href: string;
  className?: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-2 active:scale-[0.99]">
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white ${className}`}>
          {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-extrabold leading-4 text-slate-950">{title}</span>
        <span className="block truncate text-[10px] leading-3 text-slate-500">{desc}</span>
      </span>
      <span className="text-[10px] font-bold leading-3 text-blue-600">{count}</span>
    </Link>
  );
}

export default function MobileHomeClient({ siteName, siteDesc: _siteDesc }: MobileHomeProps) {
  const [data, setData] = useState<CommunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch("/api/community/home?view=mobile", { cache: "no-store", signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then((homeData) => {
        setData(homeData);
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
  const latestPosts = data?.latestPosts ?? EMPTY_POSTS;
  const hotPosts = data?.hotPosts ?? EMPTY_POSTS;
  const projects = data?.collabProjects ?? EMPTY_PROJECTS;
  const tools = data?.featuredTools ?? EMPTY_TOOLS;
  const leadPost = latestPosts[0] ?? hotPosts[0] ?? null;
  // 正在讨论：合并 hotPosts + latestPosts 去重，排除公告/置顶，按互动热度稳定排序
  const discussionPosts = useMemo(
    () => uniquePosts([...hotPosts, ...latestPosts])
      .filter((post) => post.id !== leadPost?.id)
      .filter((post) => !post.isPinned && post.category?.slug !== "announcement")
      .sort((a, b) => getPostScore(b) - getPostScore(a))
      .slice(0, 5),
    [hotPosts, latestPosts, leadPost?.id],
  );
  const featuredTools = useMemo(() => tools.slice(0, 4), [tools]);
  const challengeProject = projects[0] ?? null;
  const heatScore = Math.min(99, Math.max(36, stats.todayPostCount * 6 + discussionPosts.length * 8 + projects.length * 5));

  return (
    <main className="min-h-screen bg-[#f7f9ff]">
      <section className="relative overflow-hidden bg-slate-950 px-5 pb-7 pt-3 text-white">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(168,85,247,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.12)_1px,transparent_1px)] bg-[length:26px_26px] [mask-image:radial-gradient(circle_at_50%_25%,black,transparent_78%)]" />
        <div className="absolute -right-20 top-10 h-44 w-44 rounded-full bg-purple-600/30 blur-3xl" />
        <div className="absolute -left-16 bottom-8 h-36 w-36 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="relative">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitdLogo className="h-[34px] w-[34px] drop-shadow-[0_8px_14px_rgba(168,85,247,0.3)]" />
              <div>
                <div className="text-[13px] font-extrabold leading-5">{siteName} AI</div>
                <div className="text-[11px] leading-4 text-white/55">AI Developer pulse</div>
              </div>
            </div>
            <Link
              href="/search"
              aria-label="搜索"
              className="grid h-[30px] w-[30px] place-items-center rounded-full border border-white/15 bg-white/10 text-sm text-white/90"
            >
              ⌕
            </Link>
          </div>

          <div className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-purple-300/30 bg-purple-600/20 px-3 py-1 text-[11px] leading-4 text-purple-100">
            <span className="h-1.5 w-1.5 rounded-full bg-pink-300 shadow-[0_0_0_4px_rgba(240,171,252,0.15)]" />
            <span>AI 技术实时脉冲 · 社区驱动</span>
          </div>

          <h1 className="mb-2 max-w-[19rem] text-[22px] font-extrabold leading-[29px] tracking-[-0.032em]">
            AI 开发者的技术雷达
          </h1>
          <p className="max-w-[18.75rem] text-[11px] leading-4 text-white/65">
            追踪 AI 工具、模型实践与开发技巧，发现最前沿的 AI 开发者内容。
          </p>

          <div className="mt-3 rounded-[15px] border border-white/15 bg-white/10 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-[13px] font-extrabold leading-5">今日 AI 热度</div>
              <div className="text-[13px] font-extrabold leading-[18px] text-pink-200">{heatScore}</div>
            </div>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${heatScore}%` }} />
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] leading-4 text-white/75">
              <span className="rounded-full bg-white/10 px-2 py-0.5">AI 工具</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5">大模型</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5">Agent 开发</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5">Prompt</span>
            </div>
          </div>
        </div>
      </section>

      <section className="relative -mt-4 px-4">
        <Link
          href="/search"
          className="mb-2.5 block rounded-[18px] border border-blue-100 bg-white p-3 shadow-[0_12px_28px_rgba(37,99,235,0.12)]"
        >
          <span className="flex items-center justify-between gap-3">
            <span className="text-[14px] font-extrabold leading-5 text-slate-950">搜索技术主题、工具、项目</span>
            <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-semibold leading-4 text-blue-600">⌘K</span>
          </span>
          <span className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold leading-4 text-slate-500">
            {["Next.js", "React", "PostgreSQL", "开源项目"].map((keyword) => (
              <span key={keyword} className="rounded-full bg-slate-50 px-2 py-0.5">{keyword}</span>
            ))}
          </span>
        </Link>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-slate-200 bg-white p-2">
            <div className="text-[13px] font-extrabold leading-[18px] text-slate-950">{formatNumber(stats.userCount)}</div>
            <div className="text-[11px] leading-4 text-slate-500">开发者</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2">
            <div className="text-[13px] font-extrabold leading-[18px] text-slate-950">{stats.todayPostCount}</div>
            <div className="text-[11px] leading-4 text-slate-500">新动态</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2">
            <div className="text-[13px] font-extrabold leading-[18px] text-slate-950">{formatNumber(stats.postCount)}</div>
            <div className="text-[11px] leading-4 text-slate-500">内容源</div>
          </div>
        </div>
      </section>

      {loadError && (
        <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          社区数据暂时加载失败，稍后刷新即可。
        </div>
      )}

      <section className="mt-3 px-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold leading-[22px] text-slate-950">今日重点</h2>
          <Link href="/forum" className="text-[11px] font-semibold leading-4 text-blue-600">更多</Link>
        </div>

        {loading ? (
          <div className="h-32 animate-pulse rounded-[17px] border border-slate-200 bg-white" />
        ) : leadPost ? (
          <Link href={`/forum/post/${leadPost.id}`} className="block overflow-hidden rounded-[17px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.055)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-blue-50 px-3 py-1.5 text-[10px] font-semibold leading-4 text-blue-600">
              <span>{getPostSource(leadPost)} · {leadPost.timeAgo}</span>
              <span>{leadPost.commentCount > 0 ? `${leadPost.commentCount} 评论` : "新内容"}</span>
            </div>
            <div className="p-3">
              <div className="mb-2 flex gap-2">
                {leadPost.category && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold leading-4 text-blue-600">
                    {getCategoryDisplayName(leadPost.category.name, leadPost.category.slug)}
                  </span>
                )}
                {leadPost.isEssence && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold leading-4 text-violet-600">工程实践</span>}
              </div>
              <h3 className="mb-1 line-clamp-2 text-[14px] font-extrabold leading-5 text-slate-950">{leadPost.title}</h3>
              {leadPost.summary && <p className="mb-2 line-clamp-2 text-[11px] leading-4 text-slate-500">{leadPost.summary}</p>}
              <div className="flex items-center justify-between gap-2 text-[11px] leading-4 text-slate-500">
                <span>{leadPost.author.username} · 技术作者</span>
                <span>{formatNumber(leadPost.viewCount)} 浏览 · {formatNumber(leadPost.commentCount)} 评论</span>
              </div>
            </div>
          </Link>
        ) : null}
      </section>

      <section className="mt-3 px-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold leading-[22px] text-slate-950">正在讨论</h2>
          <Link href="/forum?sort=hot" className="text-[11px] font-semibold leading-4 text-blue-600">热榜</Link>
        </div>
        <div className="space-y-2">
          {loading
            ? Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white" />
              ))
            : discussionPosts.map((post, index) => (
                <Link key={post.id} href={`/forum/post/${post.id}`} className="grid grid-cols-[7px_1fr_auto] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <span className={index === 0 ? "h-1.5 w-1.5 rounded-full bg-green-500" : "h-1.5 w-1.5 rounded-full bg-blue-500"} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold leading-5 text-slate-950">{post.title}</span>
                    <span className="block text-[11px] leading-4 text-slate-500">{getPostSource(post)} · {post.timeAgo}</span>
                  </span>
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold leading-4 text-violet-600">
                    {index === 0 ? "热" : "新"}
                  </span>
                </Link>
              ))}
        </div>
      </section>

      <section className="mt-3 px-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold leading-[22px] text-slate-950">快速进入</h2>
          <Link href="/forum" className="text-[11px] font-semibold leading-4 text-blue-600">全部频道</Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ChannelCard icon="OS" title="开源项目" desc="项目推荐" count={latestPosts.length || 7} href="/forum/category/open-source" className="bg-violet-600" />
          <ChannelCard icon="FE" title="前端开发" desc="技术讨论" count={latestPosts.length || 6} href="/forum/category/frontend" className="bg-teal-700" />
          <ChannelCard icon="BE" title="后端开发" desc="架构实践" count={latestPosts.length || 5} href="/forum/category/backend" className="bg-blue-600" />
          <ChannelCard icon="协" title="协作" desc="项目招募" count={projects.length || 4} href="/collab" className="bg-orange-600" />
        </div>
      </section>

      <section className="mt-4 px-4">
        <div className="rounded-[17px] bg-blue-700 p-3 text-white">
          <div className="mb-1 text-[15px] font-extrabold leading-[22px]">
            {challengeProject ? "本周协作挑战" : "本周技术挑战"}
          </div>
          <p className="line-clamp-2 text-[11px] leading-4 text-white/75">
            {challengeProject
              ? `${challengeProject.title} 正在招募社区成员参与共创。`
              : "和社区一起完成一个可发布的开发者工具。"}
          </p>
          {challengeProject && (
            <div className="mt-1 text-[10px] leading-4 text-white/50">
              来源 {challengeProject.repoOwner}/{challengeProject.repoName} · 遵循原仓库开源协议
            </div>
          )}
          <div className="mt-3 flex items-center justify-between">
            <div className="text-[11px] leading-4 text-white/70">
              {challengeProject ? `${challengeProject.memberCount}/${challengeProject.maxMembers} 人参与` : "社区共创入口"}
            </div>
            <Link href={challengeProject ? `/collab/${challengeProject.id}` : "/collab"} className="rounded-full bg-white px-3 py-1 text-[11px] font-extrabold leading-4 text-blue-700">
              参与
            </Link>
          </div>
        </div>
      </section>

      {featuredTools.length > 0 && (
        <section className="mt-4 px-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold leading-[22px] text-slate-950">工具实践</h2>
            <Link href="/tools" className="text-[11px] font-semibold leading-4 text-blue-600">工具箱</Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {featuredTools.map((tool) => (
              <Link key={tool.id} href={`/tools/${tool.id}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-2 text-[11px] font-bold leading-4 text-blue-600">{tool.category || "开发工具"}</div>
                <h3 className="line-clamp-1 text-[13px] font-extrabold leading-5 text-slate-950">{tool.name}</h3>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{tool.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
