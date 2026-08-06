"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { adminFetch } from "@/lib/admin-fetch";

interface WechatVersion {
  titleCandidates: string[];
  content: string;
  summary: string;
  coverMainTitle: string;
  coverSubTitle: string;
  keyPoints: string[];
}

interface CoverPrompt {
  style: string;
  subject: string;
  elements: string;
  styles: string[];
  colorSuggestion: string;
  fullPrompt: string;
}

interface Props {
  postId: string;
  postTitle: string;
  open: boolean;
  onClose: () => void;
}

export default function WechatAdaptModal({
  postId,
  postTitle,
  open,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    wechatVersion: WechatVersion;
    coverPrompt: CoverPrompt;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"content" | "cover" | "titles">("content");

  if (!open) return null;

  async function handleGenerate() {
    try {
      setLoading(true);
      setResult(null);
      const res = await adminFetch("/api/admin/wechat-adapt", {
        method: "POST",
        body: JSON.stringify({ postId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "生成失败");
        return;
      }
      setResult(data);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">公众号文章适配</h2>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{postTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 操作栏 */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "生成中..." : "✨ 生成公众号版本"}
          </button>
          <span className="text-xs text-gray-500">
            AI 自动生成标题候选 + 公众号版正文 + 封面图文案
          </span>
        </div>

        {/* Tab 切换 */}
        {result && (
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
              <p className="text-sm text-gray-500">AI 正在生成公众号版本，约 10-20 秒...</p>
            </div>
          )}

          {!loading && !result && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl mb-4">📝</div>
              <p className="text-gray-600 font-medium">点击上方按钮生成公众号适配版本</p>
              <p className="text-xs text-gray-400 mt-2">
                包含：3个标题候选 + 公众号版正文 + 封面图文案 + 核心要点
              </p>
            </div>
          )}

          {result && activeTab === "content" && (
            <div className="space-y-4">
              {/* 摘要 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">一句话摘要</h3>
                  <button
                    onClick={() => copyText(result.wechatVersion.summary, "摘要")}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    复制
                  </button>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-900">
                  {result.wechatVersion.summary}
                </div>
              </div>

              {/* 核心要点 */}
              {result.wechatVersion.keyPoints?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">核心要点</h3>
                  <div className="space-y-1">
                    {result.wechatVersion.keyPoints.map((point, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 正文 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">公众号版正文</h3>
                  <button
                    onClick={() => copyText(result.wechatVersion.content, "正文")}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    复制全文
                  </button>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-800 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
                  {result.wechatVersion.content}
                </div>
              </div>
            </div>
          )}

          {result && activeTab === "titles" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-2">
                点击标题即可复制，选一个最吸引眼球的作为公众号标题
              </p>
              {result.wechatVersion.titleCandidates.map((title, i) => (
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

          {result && activeTab === "cover" && (
            <div className="space-y-4">
              {/* 封面文案 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">封面图文案</h3>
                <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white">
                  <div className="text-2xl font-bold mb-1">
                    {result.wechatVersion.coverMainTitle}
                  </div>
                  <div className="text-sm opacity-90">
                    {result.wechatVersion.coverSubTitle}
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() =>
                      copyText(
                        `${result.wechatVersion.coverMainTitle}\n${result.wechatVersion.coverSubTitle}`,
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
                    onClick={() => copyText(result.coverPrompt.fullPrompt, "提示词")}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    复制提示词
                  </button>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg text-sm text-orange-900">
                  {result.coverPrompt.fullPrompt}
                </div>
              </div>

              {/* 提示 */}
              <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
                💡 把提示词复制到任意 AI 绘图工具（Midjourney、DALL·E、Stable Diffusion
                等）即可生成封面图。尺寸建议：900×383（2.35:1）。
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
