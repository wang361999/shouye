"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import { adminFetch } from "@/lib/admin-fetch";
import toast from "react-hot-toast";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Textarea,
  Select,
  FormField,
  Switch,
  Icons,
} from "@/components/admin/ui";

const CATEGORY_OPTIONS = ["开发工具", "AI工具", "效率工具"];
type StatusValue = "online" | "developing" | "offline";

const STATUS_OPTIONS: { value: StatusValue; label: string; desc: string }[] = [
  { value: "online", label: "已上线", desc: "对所有用户可见" },
  { value: "developing", label: "开发中", desc: "仅管理员可见" },
  { value: "offline", label: "已下线", desc: "不对用户展示" },
];

export default function NewToolPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<StatusValue>("online");
  const [sortOrder, setSortOrder] = useState(0);
  const [category, setCategory] = useState("");
  // 高级设置
  const [isFeatured, setIsFeatured] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [coverImage, setCoverImage] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim() || !description.trim() || !url.trim()) {
      toast.error("工具名称、描述和链接不能为空");
      return;
    }

    // 简单校验 URL
    try {
      new URL(url.trim());
    } catch {
      toast.error("请输入有效的链接地址");
      return;
    }

    try {
      setSubmitting(true);
      const res = await adminFetch("/api/tools", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          url: url.trim(),
          icon: icon.trim() || null,
          category: category || null,
          // online / developing 都视作 isActive=true（developing 由前端自行控制展示）
          isActive: status !== "offline",
          isFeatured,
          needLogin,
          coverImage: coverImage.trim() || null,
          sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "创建失败");
        return;
      }

      toast.success("工具创建成功");
      router.push("/admin/tools");
    } catch {
      toast.error("创建失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminLayout activeKey="tools-new">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* 页头 */}
        <PageHeader
          title="添加工具"
          actions={
            <Button variant="ghost" onClick={() => router.push("/admin/tools")}>
              <Icons.ChevronLeft className="w-4 h-4 mr-1" />
              返回工具列表
            </Button>
          }
        />

        {/* 表单卡片 */}
        <Card>
          <CardHeader title="工具信息" subtitle="填写工具的基本信息" />
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 工具名称 */}
              <FormField label="工具名称 *">
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：JSON 格式化工具"
                />
              </FormField>

              {/* 一句话描述 */}
              <FormField label="一句话描述 *">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="简要描述工具的功能和用途"
                  rows={3}
                  className="resize-none"
                />
              </FormField>

              {/* 图标 */}
              <FormField label="图标" hint="支持输入 Emoji 或简短文字，将作为工具图标展示">
                <div className="flex items-center gap-3">
                  <Input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="输入 Emoji 或文字，例如 🔧"
                    maxLength={10}
                  />
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl border border-gray-200 flex-shrink-0">
                    {icon || "🔧"}
                  </div>
                </div>
              </FormField>

              {/* 链接地址 */}
              <FormField label="链接地址 *">
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/tool"
                />
              </FormField>

              {/* 状态 */}
              <FormField label="状态">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(opt.value)}
                      className={`text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                        status === opt.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </FormField>

              {/* 排序值 */}
              <FormField label="排序值" hint="数值越大越靠前，默认为 0">
                <Input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  placeholder="0"
                />
              </FormField>

              {/* 分类标签 */}
              <FormField label="分类标签">
                <Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">请选择分类</option>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Select>
              </FormField>

              {/* 高级设置 */}
              <div className="border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Icons.Settings className="w-4 h-4" />
                    高级设置
                  </span>
                  <Icons.ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      advancedOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {advancedOpen && (
                  <div className="mt-4 space-y-4">
                    {/* 是否在首页推荐 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-700">
                          首页推荐
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          开启后该工具将在首页推荐位展示
                        </div>
                      </div>
                      <Switch checked={isFeatured} onChange={setIsFeatured} />
                    </div>
                    {/* 是否需要登录 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-700">
                          需要登录
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          开启后用户需登录才能使用该工具
                        </div>
                      </div>
                      <Switch checked={needLogin} onChange={setNeedLogin} />
                    </div>
                    {/* 封面图 URL */}
                    <FormField label="封面图 URL">
                      <Input
                        type="url"
                        value={coverImage}
                        onChange={(e) => setCoverImage(e.target.value)}
                        placeholder="https://example.com/cover.jpg"
                      />
                    </FormField>
                  </div>
                )}
              </div>

              {/* 提交按钮 */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <Button
                  variant="secondary"
                  onClick={() => router.push("/admin/tools")}
                >
                  取消
                </Button>
                <Button type="submit" loading={submitting}>
                  {submitting ? "创建中..." : "创建工具"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  );
}
