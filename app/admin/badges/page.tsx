"use client";

import { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
import { formatDateTime } from "@/lib/admin-utils";
import toast from "react-hot-toast";
import {
  PageHeader, Card, CardBody, Button, Badge, Input, Textarea, Select,
  FormField, Modal, ConfirmDialog, DataTable, EmptyState, TableLoading,
  StatCard, SearchInput, Icons, IconButton,
} from "@/components/admin/ui";

interface BadgeData {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: string;
  condition: string | null;
  createdAt: string;
  awardedCount: number;
}

interface UserData {
  id: string;
  username: string;
  email: string;
  role: string;
}

export default function BadgesPage() {
  const { token } = useAppStore();
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // 创建徽章
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    icon: "",
    type: "manual" as "manual" | "auto",
    conditionField: "postCount",
    conditionOperator: ">=",
    conditionValue: "1",
  });

  // 颁发徽章
  const [awardOpen, setAwardOpen] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [awardBadgeId, setAwardBadgeId] = useState("");
  const [users, setUsers] = useState<UserData[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  // 删除
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBadges = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await adminFetch("/api/badges");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBadges(data.badges || []);
    } catch {
      toast.error("获取徽章列表失败");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchBadges();
  }, [token, fetchBadges]);

  // 搜索用户
  const fetchUsers = useCallback(async (q: string) => {
    if (!token || !q.trim()) return;
    try {
      const res = await adminFetch(`/api/admin/users?search=${encodeURIComponent(q)}&limit=20`);
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.data || []);
    } catch { /* ignore */ }
  }, [token]);

  const debouncedUserSearch = useCallback(
    (q: string) => {
      const t = setTimeout(() => fetchUsers(q), 300);
      return () => clearTimeout(t);
    },
    [fetchUsers],
  );

  function handleCreate() {
    if (!form.name.trim() || !form.description.trim() || !form.icon.trim()) {
      toast.error("名称、描述、图标不能为空");
      return;
    }

    setCreating(true);
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim(),
      icon: form.icon.trim(),
      type: form.type,
    };

    if (form.type === "auto") {
      body.condition = {
        field: form.conditionField,
        operator: form.conditionOperator,
        value: Number(form.conditionValue),
      };
    }

    adminFetch("/api/badges", {
      method: "POST",
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "创建失败");
        }
        toast.success("徽章创建成功");
        setCreateOpen(false);
        setForm({ name: "", description: "", icon: "", type: "manual", conditionField: "postCount", conditionOperator: ">=", conditionValue: "1" });
        fetchBadges();
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setCreating(false));
  }

  function handleAward() {
    if (!awardBadgeId || !selectedUserId) {
      toast.error("请选择徽章和用户");
      return;
    }

    setAwarding(true);
    adminFetch(`/api/badges/${awardBadgeId}/award`, {
      method: "POST",
      body: JSON.stringify({ userId: selectedUserId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "颁发失败");
        }
        toast.success("徽章颁发成功");
        setAwardOpen(false);
        setSelectedUserId("");
        setUserSearch("");
        setUsers([]);
        fetchBadges();
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setAwarding(false));
  }

  function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    // 直接通过SQL删除（没有DELETE API，用admin fetch到数据库管理）
    adminFetch(`/api/admin/database`, {
      method: "POST",
      body: JSON.stringify({
        action: "execute",
        sql: `DELETE FROM UserBadge WHERE badge_id = '${deleteId}'; DELETE FROM Badge WHERE id = '${deleteId}';`,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          // 降级：直接调用badges API没有DELETE，用提示
          toast.error("删除失败，请通过数据库管理页面手动删除");
          return;
        }
        toast.success("徽章已删除");
        setDeleteId(null);
        fetchBadges();
      })
      .catch(() => toast.error("删除失败"))
      .finally(() => setDeleting(false));
  }

  const filtered = badges.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.description.toLowerCase().includes(search.toLowerCase())
  );

  const manualCount = badges.filter((b) => b.type === "manual").length;
  const autoCount = badges.filter((b) => b.type === "auto").length;
  const totalAwarded = badges.reduce((sum, b) => sum + b.awardedCount, 0);

  return (
    <AdminLayout activeKey="badges">
      <PageHeader
        title="徽章管理"
        subtitle="创建徽章、手动颁发给用户"
        actions={
          <>
            <Button variant="secondary" onClick={() => { setAwardBadgeId(badges[0]?.id || ""); setAwardOpen(true); }} disabled={badges.length === 0}>
              <Icons.Users className="w-4 h-4" />
              颁发徽章
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Icons.Plus className="w-4 h-4" />
              创建徽章
            </Button>
          </>
        }
      />

      {/* 统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="徽章总数" value={badges.length} icon={<Icons.Scroll className="w-5 h-5" />} color="blue" />
        <StatCard label="手动徽章" value={manualCount} icon={<Icons.Key className="w-5 h-5" />} color="indigo" />
        <StatCard label="自动徽章" value={autoCount} icon={<Icons.Chart className="w-5 h-5" />} color="purple" />
        <StatCard label="已颁发总数" value={totalAwarded} icon={<Icons.Check className="w-5 h-5" />} color="green" />
      </div>

      {/* 搜索 */}
      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="搜索徽章名称或描述..." />
      </div>

      {/* 列表 */}
      <Card>
        {loading ? (
          <TableLoading cols={5} rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Icons.Scroll className="w-12 h-12" />}
            title="暂无徽章"
            description="点击右上角「创建徽章」添加第一个徽章"
            action={<Button onClick={() => setCreateOpen(true)}><Icons.Plus className="w-4 h-4" />创建徽章</Button>}
          />
        ) : (
          <DataTable headers={["图标", "名称", "描述", "类型", "已颁发", "创建时间", "操作"]}>
            {filtered.map((b) => (
              <tr key={b.id}>
                <td><span className="text-2xl">{b.icon}</span></td>
                <td><span className="font-medium text-gray-900">{b.name}</span></td>
                <td><span className="text-gray-600 max-w-xs truncate block">{b.description}</span></td>
                <td>
                  {b.type === "auto"
                    ? <Badge color="purple">自动</Badge>
                    : <Badge color="blue">手动</Badge>}
                </td>
                <td><span className="font-medium">{b.awardedCount}</span> 人</td>
                <td><span className="text-sm text-gray-500">{formatDateTime(b.createdAt)}</span></td>
                <td>
                  <div className="flex items-center gap-1">
                    <IconButton
                      icon={<Icons.Users className="w-4 h-4" />}
                      title="颁发给用户"
                      onClick={() => { setAwardBadgeId(b.id); setAwardOpen(true); }}
                    />
                    <IconButton
                      icon={<Icons.Trash className="w-4 h-4" />}
                      title="删除"
                      variant="danger"
                      onClick={() => setDeleteId(b.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      {/* 创建徽章 Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="创建徽章" size="md">
        <div className="space-y-4">
          <FormField label="徽章名称">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：技术专家" />
          </FormField>
          <FormField label="徽章描述">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="如：在技术领域有突出贡献的用户" />
          </FormField>
          <FormField label="图标" hint="输入 emoji 或图标 URL">
            <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="如：🏆" />
          </FormField>
          <FormField label="徽章类型">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "manual" | "auto" })}>
              <option value="manual">手动颁发</option>
              <option value="auto">自动颁发（满足条件自动发放）</option>
            </Select>
          </FormField>
          {form.type === "auto" && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
              <p className="text-sm font-medium text-gray-700">自动颁发条件</p>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="字段">
                  <Select value={form.conditionField} onChange={(e) => setForm({ ...form, conditionField: e.target.value })}>
                    <option value="postCount">帖子数</option>
                    <option value="commentCount">评论数</option>
                    <option value="reputation">声望值</option>
                  </Select>
                </FormField>
                <FormField label="比较">
                  <Select value={form.conditionOperator} onChange={(e) => setForm({ ...form, conditionOperator: e.target.value })}>
                    <option value=">=">≥ 大于等于</option>
                    <option value=">">&gt; 大于</option>
                    <option value="<=">≤ 小于等于</option>
                    <option value="<">&lt; 小于</option>
                    <option value="==">= 等于</option>
                  </Select>
                </FormField>
                <FormField label="数值">
                  <Input type="number" value={form.conditionValue} onChange={(e) => setForm({ ...form, conditionValue: e.target.value })} />
                </FormField>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>取消</Button>
          <Button onClick={handleCreate} loading={creating}>创建</Button>
        </div>
      </Modal>

      {/* 颁发徽章 Modal */}
      <Modal open={awardOpen} onClose={() => { setAwardOpen(false); setSelectedUserId(""); setUserSearch(""); setUsers([]); }} title="手动颁发徽章" size="md">
        <div className="space-y-4">
          <FormField label="选择徽章">
            <Select value={awardBadgeId} onChange={(e) => setAwardBadgeId(e.target.value)}>
              {badges.map((b) => (
                <option key={b.id} value={b.id}>{b.icon} {b.name}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="搜索用户">
            <SearchInput
              value={userSearch}
              onChange={(v) => { setUserSearch(v); debouncedUserSearch(v); }}
              placeholder="输入用户名或邮箱..."
            />
          </FormField>

          {users.length > 0 && (
            <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className={`flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm border-b border-gray-50 last:border-0 transition-colors ${selectedUserId === u.id ? "bg-brand-50" : "hover:bg-gray-50"}`}
                >
                  <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-medium">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{u.username}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  {u.role === "ADMIN" && <Badge color="indigo">管理员</Badge>}
                  {selectedUserId === u.id && <Icons.Check className="w-4 h-4 text-brand-600" />}
                </button>
              ))}
            </div>
          )}

          {selectedUserId && (
            <div className="flex items-center gap-2 p-3 bg-brand-50 rounded-lg text-sm text-brand-700">
              <Icons.Check className="w-4 h-4" />
              已选择: {users.find((u) => u.id === selectedUserId)?.username}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => { setAwardOpen(false); setSelectedUserId(""); setUserSearch(""); setUsers([]); }}>取消</Button>
          <Button onClick={handleAward} loading={awarding} disabled={!selectedUserId}>
            <Icons.Check className="w-4 h-4" />
            确认颁发
          </Button>
        </div>
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteId}
        title="删除徽章"
        message="确定要删除此徽章吗？已颁发给用户的记录也会一并删除，此操作不可撤销。"
        confirmText="删除"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </AdminLayout>
  );
}
