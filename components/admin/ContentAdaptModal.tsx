"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { adminFetch } from "@/lib/admin-fetch";
import { Spinner } from "@/components/admin/ui";

type Platform = "wechat" | "toutiao";

interface WechatVersion {
  titleCandidates: string[];
  content: string;
  summary: string;
  coverMainTitle: string;
  coverSubTitle: string;
  keyPoints: string[];
  coverPrompt: {
    style: string;
    fullPrompt: string;
  };
}

interface ToutiaoVersion {
  titleCandidates: string[];
  content: string;
  summary: string;
  topics: string[];
  coverMainTitle: string;
  coverSubTitle: string;
  goldenSentences: string[];
  coverPrompt: {
    style: string;
    fullPrompt: string;
  };
}

interface Props {
  defaultPostId?: string;
  defaultPostTitle?: string;
  defaultPlatform?: Platform;
  open: boolean;
  onClose: () => void;
}

export default function ContentAdaptModal({
  defaultPostId = "",
  defaultPostTitle = "",
  defaultPlatform = "wechat",
  open,
  onClose,
}: Props) {
  const [postId, setPostId] = useState(defaultPostId);
  const [postTitle, setPostTitle] = useState(defaultPostTitle);
  const [platform, setPlatform] = useState<Platform>(defaultPlatform);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    wechat?: WechatVersion;
    toutiao?: ToutiaoVersion;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"content" | "titles" | "cover">("content");

  if (!open) return null;

  async function handleGenerate() {
    const id = parsePostId(postId);
    if (!id) {
      toast.error("请输入有效的帖子 ID 或链接");
      return;
    }
    try {
      setLoading(true);
      setResult(null);
      const res = await adminFetch("/api/admin/content-adapt", {
        method: "POST",
        body: JSON.stringify({ postId: id, platform }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "生成失败");
        return;
      }
      setResult(data);
      setPostTitle(data.originalTitle || postTitle);
      setActiveTab("content");
      toast.success("生成成功");
    } catch {
      toast.error("生成失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  function copyText(text: string, label = "内容") {
    navigator.clipboard.writeText(text);
    toast.success(`${label}已复制`);
  }

  const currentData = platform === "wechat" ? result?.wechat : result?.toutiao;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">多平台内容适配</h2>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
              {postTitle || "输入帖子 ID 或链接开始生成"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 平台选择 + 输入 */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 space-y-3">
          {/* 平台切换 */}
          <div className="flex gap-2">
            {[
              { key: "wechat", label: "📱 公众号", desc: "3个标题+正文+封面" },
              { key: "toutiao", label: "📰 头条号", desc: "5个标题+原创优化+话题" },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setPlatform(p.key as Platform);
                  setResult(null);
                }}
                className={`flex-1 text-left rounded-lg border px-4 py-2.5 transition-colors ${
                  platform === p.key
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                    : "border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50"
                }`}
              >
                <div className="text-sm font-semibold text-gray-900">{p.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>

          {/* 帖子输入 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={postId}
              onChange={(e) => setPostId(e.target.value)}
              placeholder="输入帖子 ID 或链接，如 /forum/post/123"
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) handleGenerate();
              }}
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !postId.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <Spinner className="w-4 h-4" />
                  生成中...
                </>
              ) : (
                <>
                  <span className="text-base">✨</span>
                  生成{platform === "wechat" ? "公众号" : "头条"}版
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tab 切换 */}
        {currentData && (
          <div className="flex gap-1 px-6 pt-3 border-b border-gray-100">
            {[
              { key: "content", label: "正文内容" },
              { key: "titles", label: "标题候选" },
              { key: "cover", label: "封面图" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-500">
                AI 正在生成{platform === "wechat" ? "公众号" : "头条"}版本，约 10-20 秒...
              </p>
            </div>
          )}

          {!loading && !currentData && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl mb-4">✨</div>
              <p className="text-gray-600 font-medium">
                选择平台，输入帖子 ID，一键生成适配内容
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {platform === "wechat"
                  ? "公众号版：3个标题候选 + 公众号版正文 + 封面图文案 + 核心要点"
                  : "头条版：5个标题候选 + 原创优化正文 + 话题标签 + 金句 + 封面文案"}
              </p>
            </div>
          )}

          {currentData && activeTab === "content" && (
            <div className="space-y-4">
              {/* 摘要 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">一句话摘要</h3>
                  <button
                    onClick={() => copyText(currentData.summary, "摘要")}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    复制
                  </button>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-900">
                  {currentData.summary}
                </div>
              </div>

              {/* 核心要点 / 金句 */}
              {platform === "wechat" && (currentData as WechatVersion).keyPoints && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">核心要点</h3>
                  <div className="space-y-1">
                    {(currentData as WechatVersion).keyPoints.map((point, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {platform === "toutiao" && (currentData as ToutiaoVersion).goldenSentences && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">核心金句</h3>
                  <div className="space-y-2">
                    {(currentData as ToutiaoVersion).goldenSentences.map((s, i) => (
                      <div
                        key={i}
                        className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg text-sm text-purple-900 italic border-l-4 border-purple-400"
                      >
                        "{s}"
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 头条话题标签 */}
              {platform === "toutiao" && (currentData as ToutiaoVersion).topics && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">话题标签</h3>
                    <button
                      onClick={() =>
                        copyText(
                          (currentData as ToutiaoVersion).topics.map((t) => `#${t}#`).join(" "),
                          "话题标签"
                        )
                      }
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      复制
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(currentData as ToutiaoVersion).topics.map((topic, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs rounded-full border border-orange-200"
                      >
                        #{topic}#
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 正文 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {platform === "wechat" ? "公众号版正文" : "头条版正文"}
                  </h3>
                  <button
                    onClick={() => copyText(currentData.content, "正文")}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    复制全文
                  </button>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-800 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
                  {currentData.content}
                </div>
              </div>
            </div>
          )}

          {currentData && activeTab === "titles" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-2">
                点击标题即可复制，选一个最吸引眼球的作为{platform === "wechat" ? "公众号" : "头条"}标题
              </p>
              {currentData.titleCandidates.map((title, i) => (
                <div
                  key={i}
                  onClick={() => copyText(title, `标题${i + 1}`)}
                  className="p-4 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 text-xs font-bold rounded-full">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-gray-900 font-medium">{title}</span>
                    <span className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      点击复制
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentData && activeTab === "cover" && (
            <div className="space-y-4">
              {/* 封面文案 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">封面图文案</h3>
                <div className="p-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white text-center">
                  <div className="text-2xl font-bold mb-1">{currentData.coverMainTitle}</div>
                  <div className="text-sm opacity-90">{currentData.coverSubTitle}</div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() =>
                      copyText(
                        `${currentData.coverMainTitle}\n${currentData.coverSubTitle}`,
                        "封面文案"
                      )
                    }
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    复制文案
                  </button>
                </div>
              </div>

              {/* 封面图提示词 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">AI 绘图提示词</h3>
                  <button
                    onClick={() => copyText(currentData.coverPrompt.fullPrompt, "提示词")}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    复制提示词
                  </button>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg text-sm text-orange-900">
                  {currentData.coverPrompt.fullPrompt}
                </div>
              </div>

              {/* 提示 */}
              <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
                💡 把提示词复制到任意 AI 绘图工具（Midjourney、DALL·E、Stable Diffusion
                等）即可生成封面图。尺寸：{currentData.coverPrompt.style}。
              </div>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

/** 从输入中解析帖子 ID */
function parsePostId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const segs = url.pathname.split("/").filter(Boolean);
      const postIdx = segs.findIndex((s) => s === "post");
      if (postIdx !== -1 && segs[postIdx + 1]) return segs[postIdx + 1];
      const last = segs[segs.length - 1];
      return last || null;
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith("/")) {
    const segs = trimmed.split("/").filter(Boolean);
    const postIdx = segs.findIndex((s) => s === "post");
    if (postIdx !== -1 && segs[postIdx + 1]) return segs[postIdx + 1];
  }

  return trimmed;
}
