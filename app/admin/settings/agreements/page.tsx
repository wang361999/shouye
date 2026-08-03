"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
import { DEFAULT_TERMS, DEFAULT_PRIVACY } from "@/lib/default-agreements";
import toast from "react-hot-toast";

type AgreementType = "terms" | "privacy";

export default function AgreementsSettingsPage() {
  const { token } = useAppStore();
  const [activeTab, setActiveTab] = useState<AgreementType>("terms");
  const [termsContent, setTermsContent] = useState(DEFAULT_TERMS);
  const [privacyContent, setPrivacyContent] = useState(DEFAULT_PRIVACY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 获取协议内容
  const fetchAgreements = useCallback(async () => {
    try {
      setLoading(true);
      const [termsRes, privacyRes] = await Promise.all([
        fetch("/api/agreements?type=terms"),
        fetch("/api/agreements?type=privacy"),
      ]);

      if (termsRes.ok) {
        const termsData = await termsRes.json();
        if (termsData.content) setTermsContent(termsData.content);
      }
      if (privacyRes.ok) {
        const privacyData = await privacyRes.json();
        if (privacyData.content) setPrivacyContent(privacyData.content);
      }
    } catch {
      // 降级使用默认内容
      setTermsContent(DEFAULT_TERMS);
      setPrivacyContent(DEFAULT_PRIVACY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) fetchAgreements();
  }, [token, fetchAgreements]);

  // 保存
  async function handleSave() {
    try {
      setSaving(true);
      const content = activeTab === "terms" ? termsContent : privacyContent;

      const res = await adminFetch("/api/agreements", {
        method: "POST",
        body: JSON.stringify({ type: activeTab, content }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "保存失败");
        return;
      }

      const data = await res.json();
      toast.success(data.message || "保存成功");
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  // 恢复默认
  async function handleReset() {
    const defaultContent = activeTab === "terms" ? DEFAULT_TERMS : DEFAULT_PRIVACY;
    if (activeTab === "terms") {
      setTermsContent(defaultContent);
    } else {
      setPrivacyContent(defaultContent);
    }
    toast.success("已恢复默认内容，请点击保存生效");
  }

  const currentContent = activeTab === "terms" ? termsContent : privacyContent;
  const currentContentLength = currentContent.length;

  if (loading) {
    return (
      <AdminLayout activeKey="settings-agreements">
        <div className="flex items-center justify-center py-20">
          <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeKey="settings-agreements">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📄 协议文档管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            管理用户协议和隐私政策内容，支持 Markdown 格式，修改后前台实时生效
          </p>
        </div>

        {/* Tab 切换 */}
        <div className="flex items-center gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("terms")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "terms"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            用户协议
          </button>
          <button
            onClick={() => setActiveTab("privacy")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "privacy"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            隐私政策
          </button>
        </div>

        {/* 编辑区域 */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">
                {activeTab === "terms" ? "用户协议内容" : "隐私政策内容"}
              </label>
              <span className="text-xs text-gray-400">
                {currentContentLength} 字符
              </span>
            </div>
            <button
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-blue-600 transition-colors"
            >
              恢复默认
            </button>
          </div>

          <textarea
            value={currentContent}
            onChange={(e) => {
              if (activeTab === "terms") {
                setTermsContent(e.target.value);
              } else {
                setPrivacyContent(e.target.value);
              }
            }}
            rows={24}
            className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="请输入协议内容（支持 Markdown 格式）..."
          />

          <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
            <p className="font-medium text-gray-500 mb-1">💡 编辑提示</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>支持 Markdown 语法（标题、列表、加粗、引用等）</li>
              <li>修改后点击「保存」按钮，前台立即生效</li>
              <li>如需恢复初始内容，点击右上角「恢复默认」</li>
              <li>协议底部会显示更新日期，建议修改后同步更新</li>
            </ul>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between">
          <a
            href={`/agreements/${activeTab}`}
            target="_blank"
            className="text-sm text-blue-600 hover:underline"
          >
            在新窗口预览 →
          </a>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "保存中..." : "保存修改"}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
