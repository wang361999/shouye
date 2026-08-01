'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { Container } from '@/components/common/Container';
import toast from 'react-hot-toast';

// ============ 类型定义 ============
interface LicenseDomain {
  domain: string;
  activatedAt: string;
  lastVerifiedAt: string | null;
}

interface License {
  id: string;
  licenseKey: string;
  projectName: string;
  projectType: string;
  maxDomains: number;
  boundDomains: number;
  expiresAt: string;
  status: string;
  remark: string | null;
  downloadUrl: string | null;
  domains: LicenseDomain[];
  logCount: number;
  createdAt: string;
}

interface LicenseLog {
  id: string;
  licenseKey: string;
  domain: string;
  ip: string | null;
  userAgent: string | null;
  result: string;
  message: string | null;
  createdAt: string;
}

// ============ 套餐类型映射 ============
const PROJECT_TYPE_MAP: Record<string, { label: string; color: string }> = {
  basic: { label: '基础版', color: 'bg-gray-100 text-gray-700' },
  standard: { label: '标准版', color: 'bg-blue-100 text-blue-700' },
  premium: { label: '高级版', color: 'bg-purple-100 text-purple-700' },
  enterprise: { label: '企业版', color: 'bg-orange-100 text-orange-700' },
};

// ============ 状态映射 ============
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: '有效', color: 'bg-green-100 text-green-700' },
  suspended: { label: '暂停', color: 'bg-yellow-100 text-yellow-700' },
  expired: { label: '过期', color: 'bg-red-100 text-red-700' },
  revoked: { label: '吊销', color: 'bg-gray-100 text-gray-500' },
};

// ============ 验证结果映射 ============
const RESULT_MAP: Record<string, { label: string; color: string }> = {
  valid: { label: '验证通过', color: 'bg-green-100 text-green-700' },
  invalid: { label: '无效', color: 'bg-red-100 text-red-700' },
  expired: { label: '已过期', color: 'bg-red-100 text-red-700' },
  suspended: { label: '已暂停', color: 'bg-yellow-100 text-yellow-700' },
  domain_mismatch: { label: '域名不匹配', color: 'bg-orange-100 text-orange-700' },
  not_found: { label: '授权码不存在', color: 'bg-gray-100 text-gray-500' },
};

const LOG_PAGE_SIZE = 10;

type TabKey = 'licenses' | 'logs';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'licenses', label: '我的授权码', icon: '🔑' },
  { key: 'logs', label: '验证日志', icon: '📋' },
];

// ============ 工具函数 ============
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function calculateDaysLeft(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getProjectTypeMeta(type: string) {
  return (
    PROJECT_TYPE_MAP[type] || { label: type, color: 'bg-gray-100 text-gray-700' }
  );
}

function getStatusMeta(status: string) {
  return STATUS_MAP[status] || { label: status, color: 'bg-gray-100 text-gray-500' };
}

function getResultMeta(result: string) {
  return (
    RESULT_MAP[result] || { label: result, color: 'bg-gray-100 text-gray-500' }
  );
}

export default function UserLicensesPage() {
  const { user, token, hydrate, _hydrated } = useAppStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('licenses');

  // ====== 授权码列表状态 ======
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);

  // ====== 验证日志状态 ======
  const [logs, setLogs] = useState<LicenseLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);

  // ====== 绑定域名 ======
  const [bindTarget, setBindTarget] = useState<License | null>(null);
  const [bindDomainInput, setBindDomainInput] = useState('');
  const [binding, setBinding] = useState(false);

  // ====== 解绑确认 ======
  const [unbindTarget, setUnbindTarget] = useState<{
    licenseId: string;
    domain: string;
    projectName: string;
  } | null>(null);
  const [unbinding, setUnbinding] = useState(false);

  // ============ 客户端水合 ============
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // ============ 获取授权码列表 ============
  const fetchLicenses = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user/licenses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        toast.error('登录已过期，请重新登录');
        router.push('/login');
        return;
      }
      if (!res.ok) throw new Error('获取失败');
      const data = await res.json();
      setLicenses(Array.isArray(data) ? data : data.licenses || []);
    } catch {
      toast.error('获取授权码列表失败');
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    if (user && token && _hydrated) {
      fetchLicenses();
    }
  }, [user, token, _hydrated, fetchLicenses]);

  // ============ 获取验证日志 ============
  const fetchLogs = useCallback(
    async (page: number) => {
      if (!token) return;
      setLogsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(LOG_PAGE_SIZE),
        });
        const res = await fetch(`/api/user/licenses/logs?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          toast.error('登录已过期，请重新登录');
          router.push('/login');
          return;
        }
        if (!res.ok) throw new Error('获取失败');
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : data.logs || []);
        setLogTotalPages(
          data.pagination?.totalPages || data.totalPages || 1,
        );
      } catch {
        toast.error('获取验证日志失败');
      } finally {
        setLogsLoading(false);
      }
    },
    [token, router],
  );

  useEffect(() => {
    if (user && token && _hydrated && activeTab === 'logs') {
      fetchLogs(logPage);
    }
  }, [user, token, _hydrated, activeTab, logPage, fetchLogs]);

  // ============ 复制到剪贴板 ============
  async function handleCopy(text: string, label = '内容') {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label}已复制`);
    } catch {
      toast.error('复制失败，请手动复制');
    }
  }

  // ============ 打开绑定域名弹窗 ============
  function openBindModal(license: License) {
    if (license.boundDomains >= license.maxDomains) {
      toast.error('已达到最大域名配额，无法继续绑定');
      return;
    }
    if (license.status !== 'active') {
      toast.error('当前授权码状态不可用，无法绑定域名');
      return;
    }
    setBindTarget(license);
    setBindDomainInput('');
  }

  function closeBindModal() {
    if (binding) return;
    setBindTarget(null);
    setBindDomainInput('');
  }

  // ============ 提交绑定域名 ============
  async function handleBindDomain() {
    if (!token || !bindTarget) return;
    const domain = bindDomainInput.trim();
    if (!domain) {
      toast.error('请输入域名');
      return;
    }
    // 简单校验域名格式
    const domainRegex =
      /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      toast.error('域名格式不正确，例如：example.com');
      return;
    }
    setBinding(true);
    try {
      const res = await fetch('/api/user/licenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ licenseId: bindTarget.id, domain }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '绑定失败');
        return;
      }
      toast.success('域名绑定成功');
      setBindDomainInput('');
      setBindTarget(null);
      fetchLicenses();
    } catch {
      toast.error('绑定失败，请稍后重试');
    } finally {
      setBinding(false);
    }
  }

  // ============ 解绑域名 ============
  async function handleUnbindDomain() {
    if (!token || !unbindTarget) return;
    setUnbinding(true);
    try {
      const params = new URLSearchParams({
        licenseId: unbindTarget.licenseId,
        domain: unbindTarget.domain,
      });
      const res = await fetch(`/api/user/licenses?${params}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '解绑失败');
        return;
      }
      toast.success('域名已解绑');
      setUnbindTarget(null);
      fetchLicenses();
    } catch {
      toast.error('解绑失败，请稍后重试');
    } finally {
      setUnbinding(false);
    }
  }

  // ============ 渲染：水合中 ============
  if (!_hydrated) {
    return (
      <Container className="py-16 text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-500">加载中...</p>
      </Container>
    );
  }

  // ============ 渲染：未登录 ============
  if (!user || !token) {
    return (
      <Container className="py-16 text-center">
        <div className="max-w-sm mx-auto bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">请先登录</h2>
          <p className="text-sm text-gray-500 mb-6">
            登录后即可查看和管理您的授权码
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            前往登录
          </Link>
        </div>
      </Container>
    );
  }

  // ============ 渲染：主内容 ============
  return (
    <Container className="py-8">
      {/* 返回链接 */}
      <Link
        href="/profile"
        className="inline-block text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4"
      >
        &larr; 返回个人中心
      </Link>

      {/* 页面标题 */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        🔑 我的授权码
      </h1>

      {/* Tab 切换 */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============ Tab 1: 我的授权码 ============ */}
      {activeTab === 'licenses' && (
        <div>
          {loading ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse"
                >
                  <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
                  <div className="h-8 bg-gray-100 rounded w-2/3 mb-4" />
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    {[...Array(4)].map((_, j) => (
                      <div key={j} className="h-10 bg-gray-100 rounded" />
                    ))}
                  </div>
                  <div className="h-12 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          ) : licenses.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <div className="text-5xl mb-3">🔑</div>
              <p className="text-gray-400 mb-1">暂无授权码</p>
              <p className="text-sm text-gray-400 mb-4">
                您还没有任何授权码，请联系管理员获取
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {licenses.map((license) => {
                const daysLeft = calculateDaysLeft(license.expiresAt);
                const typeMeta = getProjectTypeMeta(license.projectType);
                const statusMeta = getStatusMeta(license.status);
                const quotaFull =
                  license.boundDomains >= license.maxDomains;
                const canBind =
                  license.status === 'active' && !quotaFull;

                let daysLeftColor = 'text-gray-700';
                if (daysLeft < 0) daysLeftColor = 'text-red-600';
                else if (daysLeft <= 30) daysLeftColor = 'text-orange-600';
                else daysLeftColor = 'text-green-600';

                return (
                  <div
                    key={license.id}
                    className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 hover:shadow-sm transition-shadow"
                  >
                    {/* 头部：项目名 + 标签 */}
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                            {license.projectName}
                          </h3>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${typeMeta.color}`}
                          >
                            {typeMeta.label}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusMeta.color}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                            {statusMeta.label}
                          </span>
                        </div>
                        {/* 授权码 */}
                        <div className="flex items-center gap-2">
                          <code className="flex-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs font-mono text-gray-600 break-all">
                            {license.licenseKey}
                          </code>
                          <button
                            onClick={() =>
                              handleCopy(license.licenseKey, '授权码')
                            }
                            title="复制授权码"
                            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          </button>
                        </div>
                        {license.remark && (
                          <p
                            className="text-xs text-gray-400 mt-1.5 truncate"
                            title={license.remark}
                          >
                            备注：{license.remark}
                          </p>
                        )}
                        {license.downloadUrl && (
                          <a
                            href={license.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center mt-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                            </svg>
                            GitHub 下载
                          </a>
                        )}
                      </div>
                    </div>

                    {/* 信息网格 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 bg-gray-50 rounded-lg p-4">
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">
                          到期时间
                        </div>
                        <div
                          className={`text-sm font-medium ${
                            daysLeft < 0 ? 'text-red-600' : 'text-gray-700'
                          }`}
                        >
                          {formatDate(license.expiresAt)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">
                          剩余天数
                        </div>
                        <div
                          className={`text-sm font-medium ${daysLeftColor}`}
                        >
                          {daysLeft < 0
                            ? `已过期 ${Math.abs(daysLeft)} 天`
                            : `${daysLeft} 天`}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">
                          域名配额
                        </div>
                        <div className="text-sm font-medium text-gray-700">
                          <span
                            className={quotaFull ? 'text-red-600' : ''}
                          >
                            {license.boundDomains}
                          </span>
                          <span className="text-gray-300"> / </span>
                          {license.maxDomains}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">
                          验证日志
                        </div>
                        <div className="text-sm font-medium text-gray-700">
                          {license.logCount} 条
                        </div>
                      </div>
                    </div>

                    {/* 域名配额进度条 */}
                    <div className="mb-4">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            quotaFull ? 'bg-red-500' : 'bg-blue-500'
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              license.maxDomains > 0
                                ? (license.boundDomains / license.maxDomains) *
                                    100
                                : 0,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* 已绑定域名 */}
                    <div className="border-t border-gray-100 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-700">
                          已绑定域名
                          <span className="ml-2 text-xs font-normal text-gray-400">
                            {license.domains.length} 个
                          </span>
                        </h4>
                        <button
                          onClick={() => openBindModal(license)}
                          disabled={!canBind}
                          title={
                            !canBind
                              ? quotaFull
                                ? '已达到最大域名配额'
                                : '授权码不可用'
                              : '绑定新域名'
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                          绑定域名
                        </button>
                      </div>

                      {license.domains.length === 0 ? (
                        <p className="text-sm text-gray-400 py-3">
                          尚未绑定任何域名
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {license.domains.map((d) => (
                            <div
                              key={d.domain}
                              className="flex items-center justify-between gap-3 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100"
                            >
                              <div className="min-w-0 flex-1">
                                <div
                                  className="text-sm text-gray-700 font-medium truncate"
                                  title={d.domain}
                                >
                                  {d.domain}
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                  激活于 {formatDate(d.activatedAt)}
                                  {d.lastVerifiedAt &&
                                    ` · 最近验证 ${formatDate(d.lastVerifiedAt)}`}
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  setUnbindTarget({
                                    licenseId: license.id,
                                    domain: d.domain,
                                    projectName: license.projectName,
                                  })
                                }
                                title="解绑域名"
                                className="flex-shrink-0 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                              >
                                解绑
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============ Tab 2: 验证日志 ============ */}
      {activeTab === 'logs' && (
        <div>
          {logsLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="animate-pulse p-6 space-y-3">
                <div className="h-10 bg-gray-100 rounded" />
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded" />
                ))}
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-gray-400 mb-1">暂无验证日志</p>
              <p className="text-sm text-gray-400">
                当您的授权码被验证时，记录将显示在这里
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                          时间
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                          域名
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                          验证结果
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                          IP
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                          详情消息
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {logs.map((log) => {
                        const resultMeta = getResultMeta(log.result);
                        return (
                          <tr
                            key={log.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                              {formatDateTime(log.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                              {log.domain || (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${resultMeta.color}`}
                              >
                                {resultMeta.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                              {log.ip || (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600 max-w-[280px]">
                              {log.message ? (
                                <span
                                  className="block truncate"
                                  title={log.message}
                                >
                                  {log.message}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 分页 */}
              <div className="flex items-center justify-center gap-2 pt-6">
                <button
                  onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                  disabled={logPage <= 1}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    logPage <= 1
                      ? 'text-gray-300 border-gray-200 cursor-not-allowed'
                      : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  上一页
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-600">
                  {logPage} / {logTotalPages}
                </span>
                <button
                  onClick={() =>
                    setLogPage((p) => Math.min(logTotalPages, p + 1))
                  }
                  disabled={logPage >= logTotalPages}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    logPage >= logTotalPages
                      ? 'text-gray-300 border-gray-200 cursor-not-allowed'
                      : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  下一页
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============ 绑定域名弹窗 ============ */}
      {bindTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeBindModal}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">绑定域名</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {bindTarget.projectName}
                </p>
              </div>
              <button
                onClick={closeBindModal}
                disabled={binding}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* 表单 */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                <span>域名配额</span>
                <span>
                  <span className="font-medium text-gray-700">
                    {bindTarget.boundDomains}
                  </span>
                  <span className="text-gray-300"> / </span>
                  <span className="font-medium text-gray-700">
                    {bindTarget.maxDomains}
                  </span>
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  域名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bindDomainInput}
                  onChange={(e) => setBindDomainInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBindDomain();
                    }
                  }}
                  autoFocus
                  placeholder="例如：example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  请输入需要绑定的域名，无需 http:// 前缀
                </p>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={closeBindModal}
                disabled={binding}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleBindDomain}
                disabled={binding}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {binding ? '绑定中...' : '确认绑定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 解绑确认弹窗 ============ */}
      {unbindTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !unbinding && setUnbindTarget(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            {/* 头部 */}
            <div className="px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-gray-900">
                    确认解绑域名
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    确定要解绑以下域名吗？解绑后该域名将无法通过授权验证。
                  </p>
                </div>
              </div>

              {/* 域名信息 */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="text-xs text-gray-400 mb-0.5">所属项目</div>
                <div className="text-sm font-medium text-gray-700 mb-2">
                  {unbindTarget.projectName}
                </div>
                <div className="text-xs text-gray-400 mb-0.5">解绑域名</div>
                <div className="text-sm font-medium text-gray-700 font-mono break-all">
                  {unbindTarget.domain}
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setUnbindTarget(null)}
                disabled={unbinding}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleUnbindDomain}
                disabled={unbinding}
                className="px-5 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {unbinding ? '解绑中...' : '确认解绑'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}
