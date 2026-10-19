'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ContentAdaptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId?: string;
  onSuccess?: () => void;
}

export function ContentAdaptModal({ open, onOpenChange, postId, onSuccess }: ContentAdaptModalProps) {
  const [loading, setLoading] = useState(false);
  const [originalContent, setOriginalContent] = useState('');
  const [adaptedContent, setAdaptedContent] = useState('');
  const [platform, setPlatform] = useState('wechat');
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    if (open && postId) {
      fetchOriginalContent();
    }
  }, [open, postId]);

  const fetchOriginalContent = async () => {
    try {
      const res = await fetch(`/api/forum/posts/${postId}`);
      const data = await res.json();
      if (data.post) {
        setOriginalContent(data.post.content || '');
      }
    } catch (error) {
      console.error('[CONTENT ADAPT] Failed to fetch:', error);
      toast.error('获取原文失败');
    }
  };

  const handleAdapt = async () => {
    if (!originalContent.trim()) {
      toast.error('原文内容为空');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/content-adapt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: originalContent,
          platform,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAdaptedContent(data.content || '');
        setPreviewHtml(data.previewHtml || '');
        toast.success('内容适配成功');
      } else {
        toast.error(data.error || '适配失败');
      }
    } catch (error) {
      console.error('[CONTENT ADAPT] Error:', error);
      toast.error('适配请求失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!adaptedContent.trim() || !postId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/forum/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: adaptedContent,
          platformAdaptation: platform,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('保存成功');
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast.error(data.error || '保存失败');
      }
    } catch (error) {
      console.error('[CONTENT ADAPT] Save error:', error);
      toast.error('保存请求失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>内容适配 - {platform === 'wechat' ? '微信公众号' : platform === 'zhihu' ? '知乎' : '掘金'}</DialogTitle>
          <DialogDescription>
            将论坛帖子内容适配为 {platform === 'wechat' ? '微信公众号' : platform === 'zhihu' ? '知乎' : '掘金'} 格式
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 h-[60vh]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>原文内容</Label>
              <Textarea
                value={originalContent}
                onChange={(e) => setOriginalContent(e.target.value)}
                className="h-full resize-none font-mono text-sm"
                placeholder="请输入或粘贴原文内容..."
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAdapt}
                disabled={loading || !originalContent.trim()}
                className="flex-1"
              >
                {loading ? '适配中...' : '开始适配'}
              </Button>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="wechat">微信公众号</option>
                <option value="zhihu">知乎</option>
                <option value="juejin">掘金</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>适配结果</Label>
              <div className="border rounded-md p-4 h-full overflow-auto bg-card">
                {previewHtml ? (
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                ) : adaptedContent ? (
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {adaptedContent}
                  </pre>
                ) : (
                  <div className="text-muted-foreground text-sm text-center py-8">
                    适配结果将显示在这里
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(adaptedContent)}
                disabled={!adaptedContent}
                className="flex-1"
              >
                复制内容
              </Button>
              <Button
                onClick={handleSave}
                disabled={loading || !adaptedContent.trim()}
                className="flex-1"
              >
                保存到帖子
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ContentAdaptModal;
