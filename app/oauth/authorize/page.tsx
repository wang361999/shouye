"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

// ============ 权限范围描述映射 ============
type ScopeIconType = "user" | "email" | "shield";

interface ScopeInfo {
  label: string;
  icon: ScopeIconType;
}

const SCOPE_MAP: Record<string, ScopeInfo> = {
  "user:read": { label: "读取你的基本资料（用户名、头像）", icon: "user" },
  "user:email": { label: "读取你的邮箱地址", icon: "email" },
};

// 空 scope 时默认只读取基本资料
const DEFAULT_SCOPE = "user:read";

// ============ 权限图标 ============
function ScopeIcon({ type }: { type: ScopeIconType }) {
  const cls = "w-5 h-5";
  if (type === "user") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    );
  }
  if (type === "email") {
    return (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    );
  }
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

// 解析 scope 字符串为权限列表
function parseScopes(scope: string | null): ScopeInfo[] {
  const raw = (scope || "").trim();
  // 空 scope → 默认只读取基本资料
  const list = raw
    ? raw
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [DEFAULT_SCOPE];
  return list.map(
    (s) => SCOPE_MAP[s] || { label: `获取 ${s} 权限`, icon: "shield" as ScopeIconType }
  );
}

interface AppInfo {
  name: string;
  description?: string;
  logo?: string;
  homepage?: string;
}

function AuthorizeContent() {
  const searchParams = useSearchParams();
  const { token, user, hydrate, _hydrated } = useAppStore();

  // 从 URL 参数获取授权信息
  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const scope = searchParams.get("scope");
  const state = searchParams.get("state");
  const responseType = searchParams.get("response_type");

  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);

  // 客户端水合：从 localStorage 恢复登录态
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // 获取应用信息（接口不存在或出错时降级为 URL 参数展示）
  useEffect(() => {
    if (!clientId) {
      setLoadingApp(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/oauth/app-info?client_id=${encodeURIComponent(clientId)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data?.name) setAppInfo(data);
        }
      } catch {
        // 接口不存在或网络错误，静默降级
      } finally {
        if (!cancelled) setLoadingApp(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const scopes = parseScopes(scope);
  const appName = appInfo?.name || clientId || "未知应用";
  const appLogo = appInfo?.logo;
  const appDescription = appInfo?.description;

  // 构造登录后回跳到本授权页的地址
  const currentPath = `/oauth/authorize?${searchParams.toString()}`;
  const loginHref = `/login?redirect=${encodeURIComponent(currentPath)}`;

  // 同意 / 拒绝授权
  async function handleAction(action: "approve" | "deny") {
    if (!clientId || !redirectUri) {
      toast.error("授权参数缺失，无法完成操作");
      return;
    }
    try {
      setSubmitting(action);
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state,
          action,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error_description || data.error || "操作失败");
        return;
      }
      if (data.redirect) {
        // 成功后跳转到回调地址
        window.location.href = data.redirect;
      } else {
        toast.error("未收到回调地址");
      }
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSubmitting(null);
    }
  }

  // ===== 渲染：水合中 =====
  if (!_hydrated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <span className="ml-3 text-sm text-gray-500">加载中...</span>
      </div>
    );
  }

  // ===== 渲染：未登录 =====
  if (!user || !token) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">请先登录</h1>
          <p className="text-sm text-gray-500 mb-6">
            登录账号后即可对该应用进行授权
          </p>
          <Link
            href={loginHref}
            className="inline-block w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            前往登录
          </Link>
          <div className="mt-4">
            <Link
              href="/"
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ===== 渲染：参数缺失 =====
  if (!clientId || !redirectUri) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">授权请求无效</h1>
          <p className="text-sm text-gray-500 mb-6">
            缺少必要的授权参数（client_id 或 redirect_uri）
          </p>
          <Link
            href="/"
            className="inline-block w-full py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  // ===== 渲染：应用信息加载中 =====
  if (loadingApp) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <span className="ml-3 text-sm text-gray-500">正在加载应用信息...</span>
      </div>
    );
  }

  // ===== 渲染：授权同意页 =====
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* 顶部：应用 Logo + 名称 */}
        <div className="px-8 pt-8 pb-6 text-center border-b border-gray-100">
          <div className="flex justify-center mb-3">
            {appLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={appLogo}
                alt={appName}
                className="w-16 h-16 rounded-2xl object-cover border border-gray-100"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                {appName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <h1 className="text-lg font-bold text-gray-900">{appName}</h1>
          {appDescription ? (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {appDescription}
            </p>
          ) : null}
          {responseType && responseType !== "code" ? (
            <p className="text-xs text-amber-600 mt-2">
              注意：response_type={responseType}，本系统仅支持 code
            </p>
          ) : null}
        </div>

        {/* 中间：权限说明 */}
        <div className="px-8 py-6">
          <p className="text-sm text-gray-700 mb-4 text-center">
            <span className="font-semibold text-gray-900">{appName}</span>{" "}
            请求获取以下权限
          </p>

          <ul className="space-y-3">
            {scopes.map((s, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 p-3 rounded-lg bg-gray-50"
              >
                <span className="flex-shrink-0 w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-blue-600">
                  <ScopeIcon type={s.icon} />
                </span>
                <div className="min-w-0 pt-1.5">
                  <p className="text-sm text-gray-800">{s.label}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="text-xs text-gray-400 mt-4 text-center">
            授权后，该应用将可在你授予权限范围内访问你的信息
          </p>
        </div>

        {/* 底部：按钮 */}
        <div className="px-8 pb-8 pt-2 flex gap-3">
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => handleAction("deny")}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting === "deny" ? "处理中..." : "拒绝"}
          </button>
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => handleAction("approve")}
            className="flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting === "approve" ? "处理中..." : "授权并继续"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthorizePage() {
  // useSearchParams 需要包裹在 Suspense 边界中，避免构建时报错
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      }
    >
      <AuthorizeContent />
    </Suspense>
  );
}
