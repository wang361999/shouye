import { useState, useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Copy, Check, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ============ 类型定义 ============
interface AdaptRequest {
  sourceContent: string;
  tone: string;
  platform: string;
  targetAudience: string;
  preserveCode: boolean;
  extractKeyPoints: boolean;
  customPrompt: string;
}

interface AdaptResult {
  success: boolean;
  originalLength: number;
  adaptedContent: string;
  model?: string;
}

// ============ 组件 Props ============
interface ContentAdaptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContent: string;
  onApply: (adaptedContent: string) => void;
}

const PLATFORMS = [
  { value: 'wechat', label: '微信公众号' },
  { value: 'zhihu', label: '知乎专栏' },
  { value: 'juejin', label: '掘金' },
  { value: 'csdn', label: 'CSDN' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'twitter', label: 'X (Twitter)' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'github', label: 'GitHub README' },
  { value: 'custom', label: '自定义' },
];

const TONES = [
  { value: 'professional', label: '专业严谨' },
  { value: 'friendly', label: '亲切友好' },
  { value: 'passionate', label: '热情洋溢' },
  { value: 'humorous', label: '幽默风趣' },
  { value: 'concise', label: '极简纯干货' },
];

const AUDIENCES = [
  { value: 'developer', label: '开发者/程序员' },
  { value: 'product', label: '产品经理' },
  { value: 'entrepreneur', label: '创业者/创始人' },
  { value: 'tech-lead', label: '技术负责人' },
  { value: 'student', label: '学生/初学者' },
  { value: 'general', label: '通用技术受众' },
];

export function ContentAdaptModal({
  open,
  onOpenChange,
  initialContent,
  onApply,
}: ContentAdaptModalProps) {
  const { toast } = useToast();
  const [isAdapting, setIsAdapting] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'preview'>('config');
  const [adaptedContent, setAdaptedContent] = useState('');
  const [copied, setCopied] = useState(false);

  // 配置项
  const [platform, setPlatform] = useState('wechat');
  const [tone, setTone] = useState('professional');
  const [targetAudience, setTargetAudience] = useState('developer');
  const [preserveCode, setPreserveCode] = useState(true);
  const [extractKeyPoints, setExtractKeyPoints] = useState(true);
  const [customPrompt, setCustomPrompt] = useState('');

  // 初始化源内容
  const [sourceContent, setSourceContent] = useState(initialContent);
  useEffect(() => {
    if (open) {
      setSourceContent(initialContent);
      setAdaptedContent('');
      setActiveTab('config');
    }
  }, [open, initialContent]);

  // 执行适配
  const handleAdapt = async () => {
    if (!sourceContent || sourceContent.trim().length < 10) {
      toast({
        variant: 'destructive',
        title: '内容过短',
        description: '请确保源内容至少包含 10 个字符',
      });
      return;
    }

    setIsAdapting(true);
    setAdaptedContent('');
    setActiveTab('preview');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s 超时

    try {
      const response = await fetch('/api/admin/content-adapt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceContent,
          tone,
          platform,
          targetAudience,
          preserveCode,
          extractKeyPoints,
          customPrompt,
        } as AdaptRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `请求失败 (${response.status})`);
      }

      const data: AdaptResult = await response.json();
      setAdaptedContent(data.adaptedContent);

      toast({
        title: '✅ 适配成功',
        description: `已提取关键内容并按 ${platform} 平台风格重写。`,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      const msg = error instanceof Error ? error.message : '未知错误';
      toast({
        variant: 'destructive',
        title: '适配失败',
        description: msg.includes('abort') ? '请求超时（90秒），请减少内容长度后重试' : msg,
      });
      setAdaptedContent(`# 适配失败\n\n**错误信息：** ${msg}\n\n请检查配置后重试。`);
    } finally {
      setIsAdapting(false);
    }
  };

  // 应用适配结果
  const handleApply = () => {
    if (adaptedContent) {
      onApply(adaptedContent);
      onOpenChange(false);
      toast({
        title: '已应用适配内容',
        description: '已将适配后的内容回填至编辑器',
      });
    }
  };

  // 复制到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(adaptedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        variant: 'destructive',
        title: '复制失败',
        description: '请手动选择文本复制',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI 内容适配
          </DialogTitle>
          <DialogDescription>
            自动将内容转换为目标平台风格，保留代码块核心逻辑，提取关键信息。
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'config' | 'preview')} className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 mb-2">
            <TabsTrigger value="config">配置与生成</TabsTrigger>
            <TabsTrigger value="preview">结果预览</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="mt-0 flex-1 overflow-auto">
            <div className="space-y-4">
              <div>
                <Label>目标平台</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="选择目标平台" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>语气风格</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="选择语气" />
                    </SelectTrigger>
                    <SelectContent>
                      {TONES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>目标受众</Label>
                  <Select value={targetAudience} onValueChange={setTargetAudience}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="选择受众" />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIENCES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="preserve-code"
                    checked={preserveCode}
                    onCheckedChange={(checked) => setPreserveCode(checked === true)}
                  />
                  <Label htmlFor="preserve-code" className="cursor-pointer">
                    保留代码块（保持原样，不进行改写）
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="extract-keypoints"
                    checked={extractKeyPoints}
                    onCheckedChange={(checked) => setExtractKeyPoints(checked === true)}
                  />
                  <Label htmlFor="extract-keypoints" className="cursor-pointer">
                    提取关键信息并梳理结构
                  </Label>
                </div>
              </div>

              <div>
                <Label>自定义指令（可选）</Label>
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="例如：增加一段行业背景引入；使用活泼的语气；字数控制在 1500 字内等..."
                  className="mt-1 min-h-[80px] resize-none"
                />
              </div>

              <div className="rounded-md bg-purple-50 border border-purple-200 p-3 text-sm text-purple-900">
                <p className="font-medium mb-1">💡 温馨提示</p>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  <li>适配过程会将源内容提取摘要并按目标平台风格重写。</li>
                  <li>代码块默认保留，但 AI 可能会根据平台特性调整其展示形式。</li>
                  <li>适配请求限制在 90 秒内完成，超时将自动失败。</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-0 flex-1 overflow-auto">
            {isAdapting ? (
              <div className="flex flex-col items-center justify-center h-full py-10">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-3" />
                <p className="text-sm text-gray-500">AI 正在分析源内容并进行风格适配...</p>
                <p className="text-xs text-gray-400 mt-1">平台: {platform} | 风格: {tone}</p>
              </div>
            ) : (
              <div className="flex flex-col h-full space-y-2">
                <div className="flex justify-between items-center border-b pb-2">
                  <Badge variant="secondary">适配后内容预览</Badge>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleCopy} disabled={!adaptedContent}>
                      {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                      复制
                    </Button>
                    <Button size="sm" onClick={handleApply} disabled={!adaptedContent}>
                      应用到编辑器
                    </Button>
                  </div>
                </div>
                <ScrollArea className="flex-1 min-h-[300px] w-full rounded-md border bg-muted/40 p-4">
                  {adaptedContent ? (
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
                      {adaptedContent}
                    </pre>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 text-sm">
                      <AlertCircle className="h-6 w-6 mb-2 text-gray-400" />
                      点击 &quot;生成适配内容&quot; 开始处理
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          {activeTab === 'config' ? (
            <Button onClick={handleAdapt} disabled={isAdapting}>
              {isAdapting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              生成适配内容
            </Button>
          ) : (
            <Button onClick={() => setActiveTab('config')} disabled={isAdapting}>
              返回修改
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
