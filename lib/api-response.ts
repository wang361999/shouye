import { NextResponse } from 'next/server';

/**
 * 统一 API 响应工具函数
 * 确保 API 响应格式一致性
 */

// 成功响应
export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

// 创建成功响应（201）
export function apiCreated<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

// 错误响应
export function apiError(error: string, status: number = 400) {
  return NextResponse.json({ error }, { status });
}

// 常用错误快捷方法
export const apiErrors = {
  unauthorized: (msg = '请先登录') => apiError(msg, 401),
  forbidden: (msg = '权限不足') => apiError(msg, 403),
  notFound: (msg = '资源不存在') => apiError(msg, 404),
  badRequest: (msg = '请求参数错误') => apiError(msg, 400),
  serverError: (msg = '服务器内部错误') => apiError(msg, 500),
  rateLimited: (msg = '请求过于频繁，请稍后再试') => apiError(msg, 429),
};

// 成功消息响应
export function apiMessage(message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ message, ...extra });
}
