import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SETTING_KEYS = {
  enabled: 'auto_iteration_enabled',
  requireApproval: 'auto_iteration_require_approval',
  safeMode: 'auto_iteration_safe_mode',
  lastRequest: 'auto_iteration_last_request',
  lastDeployApproval: 'auto_iteration_last_deploy_approval',
};

const DEFAULT_CONFIG = {
  enabled: false,
  requireApproval: true,
  safeMode: true,
};

function toBool(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value === 'true';
}

function safeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

async function readConfig() {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: Object.values(SETTING_KEYS) } },
  });
  const map = Object.fromEntries(rows.map((item) => [item.key, item.value]));

  return {
    enabled: toBool(map[SETTING_KEYS.enabled], DEFAULT_CONFIG.enabled),
    requireApproval: toBool(map[SETTING_KEYS.requireApproval], DEFAULT_CONFIG.requireApproval),
    safeMode: toBool(map[SETTING_KEYS.safeMode], DEFAULT_CONFIG.safeMode),
    lastRequest: map[SETTING_KEYS.lastRequest] || '',
    lastDeployApproval: map[SETTING_KEYS.lastDeployApproval] || '',
    manualDeployConfigured: Boolean(process.env.VERCEL_DEPLOY_HOOK_URL),
  };
}

async function saveSetting(key: string, value: string) {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function logOperation(
  userId: string,
  username: string,
  action: string,
  detail: string,
) {
  await prisma.operationLog.create({
    data: {
      userId,
      username,
      action,
      target: 'AutoIteration',
      detail,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    return NextResponse.json(await readConfig());
  } catch (error) {
    console.error('[AUTO ITERATION GET ERROR]', error);
    return NextResponse.json({ error: '获取自动迭代配置失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const action = safeString(body.action);

    if (action === 'update_config') {
      const enabled = Boolean(body.enabled);
      const requireApproval = body.requireApproval !== false;
      const safeMode = body.safeMode !== false;

      await prisma.$transaction([
        prisma.systemSetting.upsert({
          where: { key: SETTING_KEYS.enabled },
          update: { value: String(enabled) },
          create: { key: SETTING_KEYS.enabled, value: String(enabled) },
        }),
        prisma.systemSetting.upsert({
          where: { key: SETTING_KEYS.requireApproval },
          update: { value: String(requireApproval) },
          create: { key: SETTING_KEYS.requireApproval, value: String(requireApproval) },
        }),
        prisma.systemSetting.upsert({
          where: { key: SETTING_KEYS.safeMode },
          update: { value: String(safeMode) },
          create: { key: SETTING_KEYS.safeMode, value: String(safeMode) },
        }),
      ]);

      await logOperation(
        admin.userId,
        admin.username,
        'auto_iteration_config',
        `更新自动迭代配置：开关=${enabled ? '开启' : '关闭'}，上线确认=${requireApproval ? '需要' : '不需要'}，安全模式=${safeMode ? '开启' : '关闭'}`,
      );

      return NextResponse.json({
        message: '自动迭代配置已保存',
        config: await readConfig(),
      });
    }

    if (action === 'trigger_inspection') {
      const config = await readConfig();
      if (!config.enabled) {
        return NextResponse.json(
          { error: '自动迭代开关未开启，请先开启后再触发' },
          { status: 400 },
        );
      }

      const requirement = safeString(body.requirement, '后台手动触发免费自动巡检');
      const createdAt = new Date().toISOString();
      const requestLog = JSON.stringify({
        requirement,
        createdAt,
        status: 'waiting_for_ai_changes',
        guardrails: [
          '先生成变更日志，再由管理员确认是否上线',
          '默认不改支付、授权、权限、数据库结构和生产数据',
          '必须通过 lint/build 后才能推送',
        ],
      });

      await saveSetting(SETTING_KEYS.lastRequest, requestLog);
      await logOperation(
        admin.userId,
        admin.username,
        'auto_iteration_trigger',
        `触发自动巡检：${requirement}。AI 改完后需在日志中说明修改位置、优化内容和验证结果。`,
      );

      return NextResponse.json({
        message: '已记录自动巡检请求',
        changeLog: [
          '已记录巡检需求和安全边界',
          'AI 修改后需要输出“修改位置、优化内容、验证结果”',
          '未确认上线前，不应主动触发生产发布',
        ],
        config: await readConfig(),
      });
    }

    if (action === 'approve_deploy') {
      const approvedAt = new Date().toISOString();
      const deployHook = process.env.VERCEL_DEPLOY_HOOK_URL;
      let deployMessage = '已记录上线确认。未配置 Vercel Deploy Hook 时，请以 GitHub/Vercel 后台实际部署状态为准。';

      if (deployHook) {
        const deployRes = await fetch(deployHook, { method: 'POST' });
        if (!deployRes.ok) {
          return NextResponse.json(
            { error: '已收到确认，但触发 Vercel Deploy Hook 失败，请到 Vercel 后台查看' },
            { status: 502 },
          );
        }
        deployMessage = '已确认并触发 Vercel 重新部署。';
      }

      await saveSetting(
        SETTING_KEYS.lastDeployApproval,
        JSON.stringify({ approvedAt, username: admin.username, deployHookTriggered: Boolean(deployHook) }),
      );
      await logOperation(
        admin.userId,
        admin.username,
        'auto_iteration_deploy_approved',
        `管理员确认上线：${deployHook ? '已触发 Vercel Deploy Hook' : '已记录确认，未配置 Deploy Hook'}`,
      );

      return NextResponse.json({
        message: deployMessage,
        config: await readConfig(),
      });
    }

    return NextResponse.json(
      { error: '未知操作，请使用 update_config、trigger_inspection 或 approve_deploy' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[AUTO ITERATION POST ERROR]', error);
    return NextResponse.json({ error: '自动迭代操作失败' }, { status: 500 });
  }
}
