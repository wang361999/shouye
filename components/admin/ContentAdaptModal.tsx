"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { adminFetch } from "@/lib/admin-fetch";
import { Spinner } from "@/components/admin/ui";
import MarkdownRenderer from "@/components/forum/MarkdownRenderer";

type Platform = "wechat" | "toutiao" | "zhihu" | "juejin" | "seo";

interface BaseVersion {
  titleCandidates: string[];
  content: string;
  summary: string;
  coverMainTitle?: string;
  coverSubTitle?: string;
  coverPrompt?: {
    style: string;
    fullPrompt: string;
  };
}

interface WechatVersion extends BaseVersion {
  keyPoints: string[];
}

interface ToutiaoVersion extends BaseVersion {
  topics: string[];
  goldenSentences: string[];
}

interface ZhihuVersion extends BaseVersion {
  topics: string[];
  keyPoints: string[];
}

interface JuejinVersion extends BaseVersion {
  category: string;
  tags: string[];
}

interface SEOVersion {
  seoTitles: string[];
  metaDescriptions: string[];
  mainKeyword: string;
  longTailKeywords: string[];
  relatedKeywords: string[];
  keywordLayout: {
    positions: string[];
    headings: string[];
    internalLinks: string[];
  };
  schemaSuggestions: string[];
}

interface Props {
  defaultPostId?: string;
  defaultPostTitle?: string;
  defaultPlatform?: Platform;
  open: boolean;
  onClose: () => void;
  onOpenPicker?: () => void;
}

export default function ContentAdaptModal({
  defaultPostId = "",
  defaultPostTitle = "",
  defaultPlatform = "wechat",
  open,
  onClose,
  onOpenPicker,
}: Props) {
  const [postId, setPostId] = useState(defaultPostId);
  const [postTitle, setPostTitle] = useState(defaultPostTitle);
  const [platform, setPlatform] = useState<Platform>(defaultPlatform);
  const [loading, setLoading] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [wechatTemplate, setWechatTemplate] = useState<"technical" | "open-source">("technical");
  const [result, setResult] = useState<{
    wechat?: WechatVersion;
    toutiao?: ToutiaoVersion;
    zhihu?: ZhihuVersion;
    juejin?: JuejinVersion;
    seo?: SEOVersion;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"content" | "titles" | "cover" | "keywords">("content");

  // 打开弹窗时同步默认值（支持从帖子选择器传入）
  useEffect(() => {
    if (open) {
      setPostId(defaultPostId);
      setPostTitle(defaultPostTitle);
      setPlatform(defaultPlatform);
      setResult(null);
      setActiveTab("content");
    }
  }, [open, defaultPostId, defaultPostTitle, defaultPlatform]);

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
        const errMsg = data.error || data.detail || "生成失败";
        toast.error(errMsg, { duration: 5000 });
        console.error("[ContentAdapt] 生成失败:", data);
        return;
      }
      setResult(data);
      setPostTitle(data.originalTitle || postTitle);
      setActiveTab("content");
      toast.success("生成成功");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "生成失败";
      toast.error(errMsg + "，请稍后重试", { duration: 5000 });
      console.error("[ContentAdapt] 调用失败:", err);
    } finally {
      setLoading(false);
    }
  }

  function copyText(text: string, label = "内容") {
    navigator.clipboard.writeText(text);
    toast.success(`${label}已复制`);
  }

  // 将 AI 生成的公众号内容套用模板，以富文本格式复制到剪贴板
  async function copyWechatFormatted() {
    const wechatData = result?.wechat;
    if (!wechatData?.content) {
      toast.error("没有可格式化的内容");
      return;
    }
    try {
      setFormatting(true);
      const res = await adminFetch("/api/admin/wechat-format", {
        method: "POST",
        body: JSON.stringify({
          content: wechatData.content,
          title: wechatData.titleCandidates?.[0] || postTitle || "公众号文章",
          digest: wechatData.summary,
          template: wechatTemplate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "格式化失败");
      }

      const fullHtml = data.fullContent;
      const plainText = `${data.title}\n\n${data.digest || ""}`;

      // 优先使用 ClipboardItem API 写入 text/html
      try {
        const htmlBlob = new Blob([fullHtml], { type: "text/html" });
        const textBlob = new Blob([plainText], { type: "text/plain" });
        const clipboardItem = new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        });
        await navigator.clipboard.write([clipboardItem]);
        toast.success("公众号格式已复制，粘贴到公众号编辑器即可保留样式");
      } catch {
        // 降级：用 execCommand 复制 HTML
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = fullHtml;
        tempDiv.style.position = "fixed";
        tempDiv.style.left = "-9999px";
        tempDiv.style.top = "0";
        document.body.appendChild(tempDiv);
        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand("copy");
        selection?.removeAllRanges();
        document.body.removeChild(tempDiv);
        toast.success("公众号格式已复制，粘贴到公众号编辑器即可");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "格式化失败");
      console.error("[WechatFormat] 失败:", err);
    } finally {
      setFormatting(false);
    }
  }

  const currentData =
    platform === "wechat"
      ? result?.wechat
      : platform === "toutiao"
      ? result?.toutiao
      : platform === "zhihu"
      ? result?.zhihu
      : platform === "juejin"
      ? result?.juejin
      : null;

  const seoData = result?.seo;

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
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {[
              { key: "wechat", label: "📱 公众号" },
              { key: "toutiao", label: "📰 头条" },
              { key: "zhihu", label: "💡 知乎" },
              { key: "juejin", label: "⛏️ 掘金" },
              { key: "seo", label: "🔍 SEO" },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setPlatform(p.key as Platform);
                  setResult(null);
                }}
                className={`text-center rounded-lg border px-2 py-2 transition-colors ${
                  platform === p.key
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                    : "border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50"
                }`}
              >
                <div className="text-sm font-semibold text-gray-900">{p.label}</div>
              </button>
            ))}
          </div>

          {/* 帖子输入 */}
          <div className="space-y-2">
            {postTitle && (
              <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-blue-500 text-base">📄</span>
                  <span className="text-sm font-medium text-blue-900 truncate">
                    {postTitle}
                  </span>
                </div>
                {onOpenPicker && (
                  <button
                    onClick={onOpenPicker}
                    className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    重新选择
                  </button>
                )}
              </div>
            )}
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
              {onOpenPicker && (
                <button
                  onClick={onOpenPicker}
                  className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors inline-flex items-center gap-1"
                >
                  <span>📋</span>
                  选帖子
                </button>
              )}
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
                    生成
                    {platform === "wechat"
                      ? "公众号"
                      : platform === "toutiao"
                      ? "头条"
                      : platform === "zhihu"
                      ? "知乎"
                      : platform === "juejin"
                      ? "掘金"
                      : "SEO"}
                    版
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tab 切换 */}
        {(currentData || seoData) && (
          <div className="flex gap-1 px-6 pt-3 border-b border-gray-100">
            {(platform === "seo"
              ? [
                  { key: "titles", label: "SEO 标题" },
                  { key: "keywords", label: "关键词" },
                  { key: "content", label: "优化建议" },
                ]
              : [
                  { key: "content", label: "正文内容" },
                  { key: "titles", label: "标题候选" },
                  { key: "cover", label: "封面图" },
                ]
            ).map((tab) => (
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
                AI 正在生成
                {platform === "wechat"
                  ? "公众号"
                  : platform === "toutiao"
                  ? "头条"
                  : platform === "zhihu"
                  ? "知乎"
                  : platform === "juejin"
                  ? "掘金"
                  : "SEO"}
                版本，约 10-20 秒...
              </p>
            </div>
          )}

          {!loading && !currentData && platform !== "seo" && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl mb-4">✨</div>
              <p className="text-gray-600 font-medium">
                选择平台，输入帖子 ID，一键生成适配内容
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {platform === "wechat"
                  ? "公众号版：3个标题候选 + 公众号版正文 + 封面图文案 + 核心要点"
                  : platform === "toutiao"
                  ? "头条版：5个标题候选 + 原创优化正文 + 话题标签 + 金句 + 封面文案"
                  : platform === "zhihu"
                  ? "知乎版：3个问题式标题 + 干货分点论述 + 话题标签 + 核心观点"
                  : "掘金版：3个技术标题 + 深度正文 + 分类标签 + 封面文案"}
              </p>
            </div>
          )}

          {/* SEO 空状态 */}
          {!loading && !seoData && platform === "seo" && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-gray-600 font-medium">
                输入帖子 ID，生成 SEO 优化方案
              </p>
              <p className="text-xs text-gray-400 mt-2">
                SEO 版：5个关键词标题 + Meta描述 + 关键词布局 + 优化建议
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

              {platform === "zhihu" && (currentData as ZhihuVersion).keyPoints && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">核心观点</h3>
                  <div className="space-y-1">
                    {(currentData as ZhihuVersion).keyPoints.map((point, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-blue-500 mt-0.5">💡</span>
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {platform === "juejin" && (currentData as JuejinVersion).tags && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">掘金标签</h3>
                    <button
                      onClick={() =>
                        copyText((currentData as JuejinVersion).tags.join(", "), "标签")
                      }
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      复制
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(currentData as JuejinVersion).tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200"
                      >
                        #{tag}
                      </span>
                    ))}
                    {(currentData as JuejinVersion).category && (
                      <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs rounded-full border border-green-200">
                        分类：{(currentData as JuejinVersion).category}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 话题标签（头条/知乎共用） */}
              {(platform === "toutiao" || platform === "zhihu") &&
                (currentData as ToutiaoVersion | ZhihuVersion).topics && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700">
                        {platform === "zhihu" ? "知乎话题" : "话题标签"}
                      </h3>
                      <button
                        onClick={() =>
                          copyText(
                            (currentData as ToutiaoVersion).topics.map((t) =>
                              platform === "toutiao" ? `#${t}#` : t
                            ).join(" "),
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
                          className={`px-2.5 py-1 text-xs rounded-full border ${
                            platform === "toutiao"
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {platform === "toutiao" ? `#${topic}#` : topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* 正文 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {platform === "wechat" ? "公众号版正文" : platform === "toutiao" ? "头条版正文" : platform === "zhihu" ? "知乎版正文" : "掘金版正文"}
                  </h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => copyText(currentData.content, "正文")}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      复制全文
                    </button>
                    {platform === "wechat" && (
                      <button
                        onClick={copyWechatFormatted}
                        disabled={formatting}
                        className="text-xs text-green-600 hover:text-green-700 font-medium"
                      >
                        {formatting ? "格式化中..." : "📋 复制公众号格式"}
                      </button>
                    )}
                  </div>
                </div>

                {/* 公众号模板选择 */}
                {platform === "wechat" && (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xs text-gray-500">排版模板：</span>
                    {[
                      { value: "technical", label: "技术风格", desc: "蓝灰配色" },
                      { value: "open-source", label: "开源风格", desc: "绿色社区感" },
                    ].map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setWechatTemplate(t.value as "technical" | "open-source")}
                        className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                          wechatTemplate === t.value
                            ? "border-green-400 bg-green-50 text-green-700"
                            : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                    <span className="text-xs text-gray-400">
                      复制后粘贴到公众号编辑器自动套用样式
                    </span>
                  </div>
                )}

                <div className="p-4 bg-gray-50 rounded-lg max-h-96 overflow-y-auto">
                  <MarkdownRenderer content={currentData.content} className="prose-sm" />
                </div>
              </div>
            </div>
          )}

          {currentData && activeTab === "titles" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-2">
                点击标题即可复制，选一个最合适的作为
                {platform === "wechat"
                  ? "公众号"
                  : platform === "toutiao"
                  ? "头条"
                  : platform === "zhihu"
                  ? "知乎"
                  : "掘金"}
                标题
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

          {currentData && activeTab === "cover" && currentData.coverPrompt && (
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
                    onClick={() => copyText(currentData.coverPrompt?.fullPrompt || "", "提示词")}
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
                等）即可生成封面图。尺寸：{currentData.coverPrompt?.style}。
              </div>
            </div>
          )}

          {/* SEO: 标题 Tab */}
          {seoData && activeTab === "titles" && platform === "seo" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-2">
                5 个不同关键词布局的 SEO 标题，点击即可复制
              </p>
              {seoData.seoTitles.map((title, i) => (
                <div
                  key={i}
                  onClick={() => copyText(title, `SEO标题${i + 1}`)}
                  className="p-4 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center bg-green-100 text-green-600 text-xs font-bold rounded-full">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-gray-900 font-medium">{title}</span>
                    <span className="text-xs text-green-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      点击复制
                    </span>
                  </div>
                </div>
              ))}

              {/* Meta Description */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">Meta Description</h3>
                </div>
                {seoData.metaDescriptions.map((desc, i) => (
                  <div
                    key={i}
                    onClick={() => copyText(desc, `描述${i + 1}`)}
                    className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 mb-2 cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="text-xs text-gray-400 mb-1">候选 {i + 1}</div>
                    {desc}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SEO: 关键词 Tab */}
          {seoData && activeTab === "keywords" && platform === "seo" && (
            <div className="space-y-5">
              {/* 主关键词 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">🎯 主关键词</h3>
                <div className="inline-block px-4 py-2 bg-red-50 text-red-700 rounded-lg font-medium border border-red-200">
                  {seoData.mainKeyword}
                </div>
              </div>

              {/* 长尾关键词 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">📈 长尾关键词</h3>
                  <button
                    onClick={() =>
                      copyText(seoData.longTailKeywords.join("\n"), "长尾关键词")
                    }
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    复制全部
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {seoData.longTailKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-full border border-blue-200"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* 相关关键词 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">🔗 相关关键词</h3>
                  <button
                    onClick={() =>
                      copyText(seoData.relatedKeywords.join("\n"), "相关关键词")
                    }
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    复制全部
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {seoData.relatedKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-purple-50 text-purple-700 text-sm rounded-full border border-purple-200"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SEO: 优化建议 Tab */}
          {seoData && activeTab === "content" && platform === "seo" && (
            <div className="space-y-5">
              {/* 关键词布局建议 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">📍 关键词布局建议</h3>
                {seoData.keywordLayout?.positions && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-2">出现位置</div>
                    <div className="space-y-1">
                      {seoData.keywordLayout.positions.map((p, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="text-blue-500 mt-0.5">•</span>
                          <span>{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {seoData.keywordLayout?.headings && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-2">H2/H3 小标题优化</div>
                    <div className="space-y-1">
                      {seoData.keywordLayout.headings.map((h, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {seoData.keywordLayout?.internalLinks && (
                  <div>
                    <div className="text-xs text-gray-500 mb-2">内链建议</div>
                    <div className="space-y-1">
                      {seoData.keywordLayout.internalLinks.map((l, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="text-purple-500 mt-0.5">🔗</span>
                          <span>{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 结构化数据建议 */}
              {seoData.schemaSuggestions && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">🏗️ 结构化数据建议</h3>
                  <div className="space-y-1">
                    {seoData.schemaSuggestions.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-amber-500 mt-0.5">💡</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
