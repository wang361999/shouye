/**
 * 在线人数追踪器 — 基于 globalThis 的内存级 Presence 追踪
 *
 * 原理：
 *   每个客户端定期（30s）发送心跳，携带唯一 sessionId。
 *   服务端在 globalThis 上维护 Map<sessionId, lastSeen>。
 *   超过 90s 未刷新的 session 自动清除。
 *
 * 局限：
 *   在 Serverless 多实例环境下，每个实例独立计数，实际在线人数可能更高。
 *   对中小型社区足够用；大型站点可换 Redis/Upstash。
 *   为弥补冷启动时计数为 0 的问题，加入基础基数。
 */

const HEARTBEAT_TTL = 90_000; // 90 秒未心跳视为离线
const CLEANUP_INTERVAL = 60_000; // 每 60 秒清理一次过期 session
const BASE_COUNT = 1; // 基础基数，避免冷启动显示 0

type OnlineMap = Map<string, number>; // sessionId -> lastSeen timestamp

interface OnlineState {
  sessions: OnlineMap;
  lastCleanup: number;
}

function getOnlineState(): OnlineState {
  const g = globalThis as unknown as { __onlineState?: OnlineState };
  if (!g.__onlineState) {
    g.__onlineState = {
      sessions: new Map<string, number>(),
      lastCleanup: 0,
    };
  }
  return g.__onlineState;
}

/**
 * 记录一次心跳
 */
export function recordHeartbeat(sessionId: string): void {
  const state = getOnlineState();
  state.sessions.set(sessionId, Date.now());
  cleanupIfNeeded(state);
}

/**
 * 获取当前在线人数
 */
export function getOnlineCount(): number {
  const state = getOnlineState();
  cleanupIfNeeded(state);
  const count = state.sessions.size;
  return Math.max(count, BASE_COUNT);
}

/**
 * 清理过期的 session（懒清理，每次获取/记录时检查）
 */
function cleanupIfNeeded(state: OnlineState): void {
  const now = Date.now();
  if (now - state.lastCleanup < CLEANUP_INTERVAL) return;

  state.lastCleanup = now;
  for (const [sid, lastSeen] of state.sessions) {
    if (now - lastSeen > HEARTBEAT_TTL) {
      state.sessions.delete(sid);
    }
  }
}
