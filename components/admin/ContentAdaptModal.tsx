import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminApi } from '@/lib/api';

interface ContentAdaptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ContentAdaptModal({ open, onOpenChange, onSuccess }: ContentAdaptModalProps) {
  const [step, setStep] = useState<'input' | 'processing' | 'result'>('input');
  const [sourceType, setSourceType] = useState<'post' | 'tool' | 'product'>('post');
  const [sourceId, setSourceId] = useState('');
  const [targetCategory, setTargetCategory] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; data?: unknown } | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      try {
        const res = await adminApi.get('/api/admin/sync-categories');
        if (!active) return;
        if (Array.isArray(res)) {
          setCategories(res.map((c: { id: string; name: string; slug: string }) => ({ id: c.id, name: c.name, slug: c.slug })));
        }
      } catch {
        // 忽略分类加载失败
      }
    })();
    return () => {
      active = false;
    };
  }, [open]);

  const handleAdapt = async () => {
    if (!sourceId || !targetCategory) return;
    setStep('processing');
    setLoading(true);
    setResult(null);
    try {
      const res = await adminApi.post('/api/admin/content-adapt', {
        sourceType,
        sourceId,
        targetCategory,
      });
      setResult({ success: true, message: '内容适配完成', data: res });
      if (onSuccess) onSuccess();
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : '适配失败',
      });
    } finally {
      setLoading(false);
      setStep('result');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep('input');
    setSourceId('');
    setTargetCategory('');
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI 内容适配</DialogTitle>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>源内容类型</Label>
              <Select value={sourceType} onValueChange={(v) => setSourceType(v as 'post' | 'tool' | 'product')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="post">论坛帖子</SelectItem>
                  <SelectItem value="tool">工具</SelectItem>
                  <SelectItem value="product">产品</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>源内容 ID</Label>
              <Input
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                placeholder="请输入源内容的 ID"
              />
            </div>

            <div className="space-y-2">
              <Label>目标分类</Label>
              <Select value={targetCategory} onValueChange={setTargetCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="选择目标分类" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            <p className="text-muted-foreground">AI 正在分析并适配内容…</p>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4 py-2">
            <div className={`rounded-md p-4 ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <p className="font-medium">{result.success ? '成功' : '失败'}</p>
              <p className="text-sm mt-1">{result.message}</p>
              {result.data ? (
                <pre className="text-xs mt-2 whitespace-pre-wrap break-all">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              ) : null}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'input' && (
            <Button onClick={handleAdapt} disabled={loading || !sourceId || !targetCategory}>
              开始适配
            </Button>
          )}
          {step === 'result' && (
            <Button onClick={handleClose}>关闭</Button>
          )}
          <p className="text-xs text-muted-foreground">
            提示：若目标分类规则不完全匹配,可利用&quot;内容适配&quot;扩展映射。
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
