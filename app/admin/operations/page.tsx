"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
import toast from "react-hot-toast";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Textarea,
  Select,
  Switch,
  Spinner,
  Badge,
  Icons,
} from "@/components/admin/ui";

// ============ 工作流定义 ============
const WORKFLOWS = [
  { id: "auto-content-creator.yml", name: "写博客", desc: "自动生成深度技术文章", icon: "✍️" },
  { id: "auto-weekly-report.yml", name: "周报", desc: "生成每周站点运营报告", icon: "📊" },
  { id: "auto-forum-poster.yml", name: "自动发帖", desc: "开发教程与项目推荐", icon: "💬" },
  { id: "auto-forum-reply.yml", name: "自动回复", desc: "回复无评论的帖子", icon: "↩️" },
  { id: "auto-patrol.yml", name: "自动巡检", desc: "检查并改进网站", icon: "🔍" },
  { id: "auto-seo-optimizer.yml", name: "SEO 优化", desc: "补充页面 meta 标签", icon: "📈" },
  { id: "auto-categorizer.yml", name: "自动分类", desc: "工具与帖子自动归类", icon: "🏷️" },
  { id: "auto-announcer.yml", name: "自动公告", desc: "发布站点公告", icon: "📢" },
  { id: "auto-link-checker.yml", name: "链接检查", desc: "检测失效链接", icon: "🔗" },
  { id: "auto-stale-cleanup.yml", name: "过期清理", desc: "清理过期数据", icon: "🧹" },
];

// ============ 定时任务定义 ============
interface ScheduleTask {
  key: string;
  hourKey: string;
  name: string;
  desc: string;
  hasTimeSelector: boolean;
  sharedToggle?: string;
}

const SCHEDULE_TASKS: ScheduleTask[] = [
  { key: "patrolEnabled", hourKey: "patrolHour", name: "自动巡检", desc: "每天自动检查并改进网站", hasTimeSelector: true },
  { key: "posterEnabled", hourKey: "posterHour1", name: "自动发帖 (第一篇)", desc: "开发教程或开源项目推荐", hasTimeSelector: true },
  { key: "posterEnabled2", hourKey: "posterHour2", name: "自动发帖 (第二篇)", desc: "第二篇帖子发送时间", hasTimeSelector: true, sharedToggle: "posterEnabled" },
  { key: "seoEnabled", hourKey: "seoHour", name: "自动 SEO 优化", desc: "自动补充页面 meta 标签", hasTimeSelector: true },
  { key: "creatorEnabled", hourKey: "creatorHour", name: "自动写博客", desc: "自动生成深度技术文章", hasTimeSelector: true },
  { key: "replyEnabled", hourKey: "", name: "自动回复论坛", desc: "每 2 小时检查并回复", hasTimeSelector: false },
];

export default function OperationsPage() {
  const { token } = useAppStore();

  // ---- AI 迭代 ----
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [iterationRequirement, setIterationRequirement] = useState("");
  const [aiActionLoading, setAiActionLoading] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // ---- 工作流触发 ----
  const [workflowLoading, setWorkflowLoading] = useState<string | null>(null);
  const [triggerAllLoading, setTriggerAllLoading] = useState(false);
  const [triggerResults, setTriggerResults] = useState<{
    success: number;
    failed: number;
    details: Array<{ name: string; status: string; message?: string }>;
  } | null>(null);
  const [workflowMessages, setWorkflowMessages] = useState<Record<string, string>>({});

  // ---- 定时任务 ----
  const [schedule, setSchedule] = useState({
    patrolEnabled: true,
    patrolHour: 10,
    posterEnabled: true,
    posterHour1: 9,
    posterHour2: 15,
    seoEnabled: true,
    seoHour: 14,
    creatorEnabled: true,
    creatorHour: 16,
    replyEnabled: true,
  });
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // ---- 通用加载 ----
  const [initLoading, setInitLoading] = useState(true);

  // ============ 数据获取 ============
  const fetchAll = useCallback(async () => {
    if (!token) return;
    try {
      const [dashRes, schedRes] = await Promise.all([
        adminFetch("/api/admin/free-dashboard"),
        adminFetch("/api/admin/schedule"),
      ]);

      if (dashRes.ok) {
        const dash = await dashRes.json();
        setAiEnabled(dash.autoIteration?.enabled ?? false);
      }

      if (schedRes.ok) {
        const sched = await schedRes.json();
        setSchedule(sched);
      }
    } catch {
      // 静默处理，不显示错误
    } finally {
      setInitLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ============ AI 迭代操作 ============
  async function runAiAction(
    action: "update_config" | "trigger_inspection" | "approve_deploy",
    payload: Record<string, unknown> = {},
  ) {
    if (!token) return;
    setAiActionLoading(action);
    setAiMessage(null);
    try {
      const res = await adminFetch("/api/admin/auto-iteration", {
        method: "POST",
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await res.json();
      if (!res.ok) {
        setAiMessage(result.error || "操作失败");
        toast.error(result.error || "操作失败");
        return;
      }
      setAiMessage(result.message || "操作成功");
      toast.success(result.message || "操作成功");
      if (action === "update_config") {
        setAiEnabled((prev) => !prev);
      }
    } catch {
      setAiMessage("网络请求失败");
      toast.error("网络请求失败");
    } finally {
      setAiActionLoading(null);
    }
  }

  // ============ 单独触发工作流 ============
  async function triggerWorkflow(wfId: string, wfName: string) {
    if (!token) return;
    setWorkflowLoading(wfId);
    setWorkflowMessages((prev) => ({ ...prev, [wfId]: "" }));
    try {
      const res = await adminFetch("/api/admin/trigger-workflow", {
        method: "POST",
        body: JSON.stringify({ workflow: wfId }),
      });
      const result = await res.json();
      if (res.ok) {
        setWorkflowMessages((prev) => ({ ...prev, [wfId]: "已触发" }));
        toast.success(`「${wfName}」已成功触发`);
      } else {
        setWorkflowMessages((prev) => ({ ...prev, [wfId]: result.error || "失败" }));
        toast.error(result.error || `「${wfName}」触发失败`);
      }
    } catch {
      setWorkflowMessages((prev) => ({ ...prev, [wfId]: "网络错误" }));
      toast.error(`「${wfName}」网络请求失败`);
    } finally {
      setWorkflowLoading(null);
      // 3秒后清除消息
      setTimeout(() => {
        setWorkflowMessages((prev) => {
          const next = { ...prev };
          delete next[wfId];
          return next;
        });
      }, 3000);
    }
  }

  // ============ 一键触发全部 ============
  async function triggerAllWorkflows() {
    if (!token) return;
    setTriggerAllLoading(true);
    setTriggerResults(null);
    try {
      const res = await adminFetch("/api/admin/trigger-all-workflows", { method: "POST" });
      const result = await res.json();
      if (res.ok) {
        setTriggerResults({
          success: result.successCount || 0,
          failed: result.failedCount || 0,
          details: result.results || [],
        });
        toast.success(`已触发 ${result.successCount} 个工作流`);
      } else {
        toast.error(result.error || "触发失败");
      }
    } catch {
      toast.error("网络请求失败");
    } finally {
      setTriggerAllLoading(false);
    }
  }

  // ============ 保存定时设置 ============
  async function saveSchedule() {
    if (!token) return;
    setScheduleLoading(true);
    try {
      const res = await adminFetch("/api/admin/schedule", {
        method: "POST",
        body: JSON.stringify(schedule),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success("定时配置已保存");
      } else {
        toast.error(result.error || "保存失败");
      }
    } catch {
      toast.error("保存失败");
    } finally {
      setScheduleLoading(false);
    }
  }

  // ============ 小时选项 ============
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  if (initLoading) {
    return (
      <AdminLayout activeKey="operations">
        <div className="flex items-center justify-center py-20">
          <Spinner className="w-8 h-8" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeKey="operations">
      <div className="space-y-6">
        <PageHeader
          title="运营中心"
          subtitle="AI 迭代、工作流触发、定时任务调度"
          actions={
            <Button variant="secondary" onClick={fetchAll}>
              <Icons.Chart className="w-4 h-4" />
              刷新状态
            </Button>
          }
        />

        {/* ==================== AI 自动迭代 ==================== */}
        <Card className="border-indigo-200 bg-indigo-50/30">
          <CardHeader
            title="AI 自动迭代"
            subtitle="提交需求，AI 自动写代码并部署"
            action={
              <div className="flex items-center gap-2">
                <Badge color={aiEnabled ? "green" : "gray"}>
                  {aiEnabled ? "运行中" : "已关闭"}
                </Badge>
                <Switch
                  checked={aiEnabled}
                  onChange={(v) => runAiAction("update_config", { enabled: v, requireApproval: true, safeMode: true })}
                  disabled={aiActionLoading === "update_config"}
                />
              </div>
            }
          />
          <CardBody>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 左侧：需求输入 */}
              <div className="lg:col-span-2 space-y-3">
                <label className="text-sm font-medium text-gray-700">迭代需求</label>
                <Textarea
                  value={iterationRequirement}
                  onChange={(e) => setIterationRequirement(e.target.value)}
                  placeholder="输入你的迭代需求，比如：后台订单列表增加按用户名搜索功能"
                  rows={4}
                  className="bg-white"
                />
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => {
                      const req = iterationRequirement.trim();
                      if (!req) {
                        toast.error("请先输入迭代需求");
                        return;
                      }
                      runAiAction("trigger_inspection", { requirement: req });
                      setIterationRequirement("");
                    }}
                    disabled={aiActionLoading === "trigger_inspection" || !aiEnabled}
                    loading={aiActionLoading === "trigger_inspection"}
                  >
                    <Icons.Robot className="w-4 h-4" />
                    提交迭代请求
                  </Button>
                  {!aiEnabled && (
                    <span className="text-xs text-gray-400">请先开启实验开关</span>
                  )}
                </div>
              </div>

              {/* 右侧：确认上线 */}
              <div className="space-y-3">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm font-medium text-green-800">自动闭环流程</p>
                  <p className="mt-1 text-xs text-green-600 leading-relaxed">
                    提交需求 → AI 写代码 → 自动验证 → 自动合并 → Vercel 部署
                  </p>
                </div>
                <Button
                  variant="primary"
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => runAiAction("approve_deploy")}
                  disabled={aiActionLoading === "approve_deploy"}
                  loading={aiActionLoading === "approve_deploy"}
                >
                  <Icons.Check className="w-4 h-4" />
                  确认上线
                </Button>
                <p className="text-xs text-gray-400 text-center">
                  确认后触发 Vercel 部署
                </p>
              </div>
            </div>

            {aiMessage && (
              <div className="mt-4 rounded-lg bg-white/70 px-4 py-2.5 text-sm text-indigo-800 border border-indigo-100">
                {aiMessage}
              </div>
            )}
          </CardBody>
        </Card>

        {/* ==================== 工作流触发 ==================== */}
        <Card>
          <CardHeader
            title="工作流触发"
            subtitle="手动触发 GitHub Actions 自动化任务"
            action={
              <Button
                onClick={triggerAllWorkflows}
                loading={triggerAllLoading}
                disabled={workflowLoading !== null}
              >
                <Icons.Robot className="w-4 h-4" />
                一键触发全部
              </Button>
            }
          />
          <CardBody>
            {/* 一键触发结果 */}
            {triggerResults && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-sm font-medium text-gray-700">触发结果</span>
                  <Badge color="green">成功 {triggerResults.success}</Badge>
                  {triggerResults.failed > 0 && <Badge color="red">失败 {triggerResults.failed}</Badge>}
                </div>
                {triggerResults.details.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {triggerResults.details.map((r, i) => (
                      <div
                        key={i}
                        className={`rounded-lg px-3 py-2 text-xs border ${
                          r.status === "success"
                            ? "bg-green-50 text-green-700 border-green-100"
                            : "bg-red-50 text-red-700 border-red-100"
                        }`}
                      >
                        <p className="font-medium">{r.name}</p>
                        <p className="mt-0.5">{r.status === "success" ? "已触发" : r.message || "失败"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 工作流网格 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {WORKFLOWS.map((wf) => {
                const isLoading = workflowLoading === wf.id;
                const msg = workflowMessages[wf.id];
                return (
                  <div
                    key={wf.id}
                    className={`rounded-xl border p-4 transition-all ${
                      msg === "已触发"
                        ? "border-green-200 bg-green-50"
                        : msg
                          ? "border-red-200 bg-red-50"
                          : "border-gray-200 bg-white hover:border-brand-300 hover:shadow-card-hover"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{wf.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{wf.name}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mb-3 line-clamp-1">{wf.desc}</p>
                    <button
                      onClick={() => triggerWorkflow(wf.id, wf.name)}
                      disabled={isLoading || triggerAllLoading}
                      className={`w-full rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        msg === "已触发"
                          ? "bg-green-100 text-green-700"
                          : msg
                            ? "bg-red-100 text-red-700"
                            : "bg-brand-50 text-brand-600 hover:bg-brand-100"
                      }`}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-1">
                          <Spinner className="w-3 h-3" />
                          触发中
                        </span>
                      ) : msg ? (
                        msg
                      ) : (
                        "触发"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* ==================== 定时任务调度 ==================== */}
        <Card>
          <CardHeader
            title="定时任务调度"
            subtitle="配置自动化任务的执行时间（北京时间）"
            action={
              <Button onClick={saveSchedule} loading={scheduleLoading}>
                <Icons.Check className="w-4 h-4" />
                保存设置
              </Button>
            }
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SCHEDULE_TASKS.map((task) => {
                const toggleKey = "sharedToggle" in task ? task.sharedToggle : task.key;
                const isEnabled = schedule[toggleKey as keyof typeof schedule] as boolean;
                const hourValue = task.hourKey
                  ? (schedule[task.hourKey as keyof typeof schedule] as number)
                  : 0;

                return (
                  <div
                    key={task.key}
                    className={`rounded-xl border p-4 transition-colors ${
                      isEnabled ? "border-brand-200 bg-brand-50/30" : "border-gray-200 bg-gray-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-800">{task.name}</span>
                      <Switch
                        checked={isEnabled}
                        onChange={(v) => {
                          if (toggleKey) {
                            setSchedule((prev) => ({ ...prev, [toggleKey]: v }));
                          }
                        }}
                        disabled={!!task.sharedToggle}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{task.desc}</p>
                    {task.hasTimeSelector ? (
                      <Select
                        value={hourValue}
                        onChange={(e) => {
                          if (task.hourKey) {
                            setSchedule((prev) => ({ ...prev, [task.hourKey]: Number(e.target.value) }));
                          }
                        }}
                        disabled={!isEnabled}
                        className="text-sm"
                      >
                        {hourOptions.map((h) => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, "0")}:00
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <div className="text-sm text-gray-400 py-2">自动运行，无需设定时间</div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  );
}
