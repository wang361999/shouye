/**
 * 带重试机制的 fetch 工具
 *
 * 自动重试失败的请求（网络错误、超时、5xx），
 * 使用指数退避策略避免雪崩。
 */

interface FetchRetryOptions extends RequestInit {
  /** 最大重试次数（默认 2） */
  maxRetries?: number;
  /** 初始延迟毫秒（默认 500） */
  initialDelay?: number;
  /** 请求超时毫秒（默认 10000） */
  timeout?: number;
  /** 哪些状态码应该重试（默认 [503, 502, 504]） */
  retryOnStatus?: number[];
}

/**
 * 带超时和重试的 fetch
 *
 * - 首次请求超时后会自动重试
 * - 5xx 错误会重试，4xx 不会
 * - 使用 AbortController 实现超时
 */
export async function fetchWithRetry(
  url: string,
  options: FetchRetryOptions = {},
): Promise<Response> {
  const {
    maxRetries = 2,
    initialDelay = 500,
    timeout = 10000,
    retryOnStatus = [503, 502, 504],
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // 合并外部 signal 和内部 timeout signal
    if (fetchOptions.signal) {
      const externalSignal = fetchOptions.signal;
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', () => controller.abort());
      }
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 检查是否需要重试
      if (retryOnStatus.includes(response.status) && attempt < maxRetries) {
        // 指数退避：500ms, 1000ms, 2000ms...
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));

      // 最后一次尝试，直接抛出
      if (attempt >= maxRetries) {
        break;
      }

      // 指数退避
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('请求失败');
}

/**
 * 带重试的 JSON fetch
 *
 * 返回解析后的 JSON 数据，类型安全。
 */
export async function fetchJsonWithRetry<T = unknown>(
  url: string,
  options?: FetchRetryOptions,
): Promise<T> {
  const response = await fetchWithRetry(url, options);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const error = new Error(errorBody.error || `请求失败 (${response.status})`);
    (error as any).status = response.status;
    (error as any).body = errorBody;
    throw error;
  }
  return response.json() as Promise<T>;
}
