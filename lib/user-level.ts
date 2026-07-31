/**
 * 用户等级系统
 * 根据用户互动数（帖子数 + 评论数）计算用户等级
 */

// ============ 等级定义 ============
export interface UserLevelInfo {
  /** 等级数字 1-6 */
  level: number;
  /** 等级标题 */
  title: string;
  /** 等级图标 emoji */
  icon: string;
  /** 当前经验值（互动总数） */
  currentExp: number;
  /** 升至下一级所需经验值（满级时为当前等级阈值） */
  nextLevelExp: number;
}

interface LevelConfig {
  level: number;
  title: string;
  icon: string;
  min: number;
  max: number;
}

// ============ 等级配置表 ============
// Level 1 (新手): 0-4
// Level 2 (活跃): 5-19
// Level 3 (熟手): 20-49
// Level 4 (老手): 50-99
// Level 5 (专家): 100-199
// Level 6 (大师): 200+
const LEVEL_CONFIGS: LevelConfig[] = [
  { level: 1, title: '新手', icon: '🌱', min: 0, max: 4 },
  { level: 2, title: '活跃', icon: '🌿', min: 5, max: 19 },
  { level: 3, title: '熟手', icon: '🌳', min: 20, max: 49 },
  { level: 4, title: '老手', icon: '🌲', min: 50, max: 99 },
  { level: 5, title: '专家', icon: '🎄', min: 100, max: 199 },
  { level: 6, title: '大师', icon: '🏆', min: 200, max: Infinity },
];

/**
 * 计算用户等级信息
 * @param postCount 用户发帖数
 * @param commentCount 用户评论数
 * @returns 用户等级信息对象
 */
export function getUserLevel(
  postCount: number,
  commentCount: number,
): UserLevelInfo {
  const currentExp = (postCount || 0) + (commentCount || 0);

  // 查找当前等级配置
  const current = LEVEL_CONFIGS.find(
    (cfg) => currentExp >= cfg.min && currentExp <= cfg.max,
  ) || LEVEL_CONFIGS[0];

  // 查找下一级配置（满级则为 null）
  const nextLevelIndex = current.level; // level 从 1 开始，索引 = level - 1，下一级 = level
  const nextLevel = LEVEL_CONFIGS[nextLevelIndex] || null;

  return {
    level: current.level,
    title: current.title,
    icon: current.icon,
    currentExp,
    // 满级时返回当前等级的最小阈值，否则返回下一级的最小阈值
    nextLevelExp: nextLevel ? nextLevel.min : current.min,
  };
}

/**
 * 获取全部等级配置（用于等级展示组件）
 */
export function getAllLevels(): LevelConfig[] {
  return LEVEL_CONFIGS;
}

/**
 * 计算升至下一级还需要的经验值
 * 满级时返回 0
 */
export function getExpToNextLevel(postCount: number, commentCount: number): number {
  const info = getUserLevel(postCount, commentCount);
  if (info.level >= LEVEL_CONFIGS.length) return 0;
  return Math.max(0, info.nextLevelExp - info.currentExp);
}

/**
 * 计算当前等级的进度百分比（0-100）
 * 满级时返回 100
 */
export function getLevelProgress(postCount: number, commentCount: number): number {
  const currentExp = (postCount || 0) + (commentCount || 0);
  const current = LEVEL_CONFIGS.find(
    (cfg) => currentExp >= cfg.min && currentExp <= cfg.max,
  ) || LEVEL_CONFIGS[0];

  // 满级
  if (current.level >= LEVEL_CONFIGS.length) return 100;

  const rangeSize = current.max - current.min + 1;
  const progressInLevel = currentExp - current.min;
  return Math.min(100, Math.round((progressInLevel / rangeSize) * 100));
}
