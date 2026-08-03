/**
 * 后台前端鉴权 fetch 封装
 * 自动附加 Bearer token，401 时自动登出跳转
 * 消除 30+ 处重复的 fetch + Authorization 样板代码
 */
import { useAppStore } from './store';

export async function adminFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = useAppStore.getState().token;
  if (!token) {
    throw new Error('未登录');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...((options.headers as Record<string, string>) || {}),
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    useAppStore.getState().logout();
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
    throw new Error('登录已过期');
  }

  return res;
}

/** adminFetch + 自动解析 JSON + 统一错误提示 */
export async function adminFetchJSON<T = any>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await adminFetch(url, options);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data as T;
}
