'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Download,
  Upload,
  Save,
  RefreshCw,
  Check,
  X,
  FileText,
  Settings,
  Zap,
  Trash2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Plus,
  Minus,
  Search,
  Filter,
  Eye,
  Edit3,
  Code,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface ContentAdaptModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: string | null;
  contentType: 'post' | 'product' | 'tool';
}

interface AdaptConfig {
  id?: string;
  sourceContentId: string;
  targetContentType: 'post' | 'product' | 'tool';
  targetContentId?: string;
  adaptType: 'convert' | 'optimize' | 'localize';
  templateId?: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  config: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  contentType: 'post' | 'product' | 'tool';
  template: Record<string, unknown>;
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'number' | 'boolean';
    required?: boolean;
    options?: Array<{ value: string; label: string }>;
  }>;
  isActive: boolean;
  createdAt: string;
}

export function ContentAdaptModal({ isOpen, onClose, contentId, contentType }: ContentAdaptModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'adapt' | 'templates' | 'history'>('adapt');
  const [config, setConfig] = useState<Partial<AdaptConfig>>({
    sourceContentId: contentId || '',
    targetContentType: contentType,
    adaptType: 'convert',
    priority: 5,
    config: {},
  });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<AdaptConfig[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>('');

  // 加载历史
  const loadHistory = useCallback(async () => {
    if (!contentId) return;
    
    try {
      const { data, error } = await supabase
        .from('content_adapt_config')
        .select('*')
        .eq('source_content_id', contentId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('加载历史记录失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载历史记录，请稍后重试',
        variant: 'destructive',
      });
    }
  }, [contentId, toast]);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
      loadTemplates();
    }
  }, [isOpen, loadHistory]);

  // 加载模板
  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('content_adapt_templates')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: true });
      
      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('加载模板失败:', error);
    }
  };

  // 选择模板
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setConfig(prev => ({
        ...prev,
        templateId,
        adaptType: 'convert' as const,
        config: {
          ...(prev.config || {}),
          ...template.template,
        },
      }));
    }
  };

  // 执行适配
  const handleAdapt = async () => {
    if (!contentId || !selectedTemplate) {
      toast({
        title: '配置不完整',
        description: '请选择源内容和模板',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setShowResult(false);

    try {
      // 调用 AI 适配 API
      const response = await fetch('/api/admin/content-adapt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceContentId: contentId,
          targetContentType: config.targetContentType || contentType,
          adaptType: config.adaptType || 'convert',
          templateId: selectedTemplate,
          config: config.config,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '适配失败');
      }

      setResult(data.result);
      setShowResult(true);

      // 保存记录
      await saveAdaptRecord(data.result);

      toast({
        title: '适配成功',
        description: '内容已成功适配',
      });
    } catch (error) {
      console.error('适配失败:', error);
      setError(error instanceof Error ? error.message : '未知错误');
      toast({
        title: '适配失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // 保存适配记录
  const saveAdaptRecord = async (adaptResult: Record<string, unknown>) => {
    try {
      const { error } = await supabase.from('content_adapt_config').insert({
        source_content_id: contentId,
        target_content_type: config.targetContentType || contentType,
        adapt_type: config.adaptType || 'convert',
        template_id: selectedTemplate,
        priority: config.priority || 5,
        status: 'completed',
        config: config.config || {},
        result: adaptResult,
        created_by: 'admin',
      });

      if (error) throw error;
      
      // 重新加载历史
      loadHistory();
    } catch (error) {
      console.error('保存适配记录失败:', error);
    }
  };

  // 生成内容预览
  const generateContentPreview = useCallback(() => {
    if (!result) return '';

    const { title, content, tags } = result;
    let preview = '';

    if (title) {
      preview += `# ${title}\n\n`;
    }

    if (content) {
      preview += `${content}\n\n`;
    }

    if (tags && Array.isArray(tags)) {
      preview += `标签: ${tags.join(', ')}\n`;
    }

    return preview;
  }, [result]);

  // 导出结果
  const handleExport = () => {
    if (!result) return;

    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adapt-result-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: '导出成功',
      description: '结果已导出为 JSON 文件',
    });
  };

  // 清空结果
  const handleClear = () => {
    setResult(null);
    setError(null);
    setShowResult(false);
    setGeneratedContent('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>内容适配</DialogTitle>
          <DialogDescription>
            将当前内容适配为其他类型或优化现有内容
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="adapt">
              <Sparkles className="h-4 w-4 mr-2" />
              执行适配
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FileText className="h-4 w-4 mr-2" />
              模板管理
            </TabsTrigger>
            <TabsTrigger value="history">
              <RefreshCw className="h-4 w-4 mr-2" />
              历史记录
            </TabsTrigger>
          </TabsList>

          {/* 执行适配标签页 */}
          <TabsContent value="adapt" className="mt-4">
            <div className="space-y-6">
              {/* 配置区域 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    适配配置
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="source-content">源内容 ID</Label>
                      <Input
                        id="source-content"
                        value={contentId || ''}
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="target-type">目标内容类型</Label>
                      <select
                        id="target-type"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={config.targetContentType || contentType}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          targetContentType: e.target.value as any,
                        }))}
                      >
                        <option value="post">帖子</option>
                        <option value="product">产品</option>
                        <option value="tool">工具</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="adapt-type">适配类型</Label>
                      <select
                        id="adapt-type"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={config.adaptType || 'convert'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          adaptType: e.target.value as any,
                        }))}
                      >
                        <option value="convert">类型转换</option>
                        <option value="optimize">内容优化</option>
                        <option value="localize">本地化</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="template">选择模板</Label>
                      <select
                        id="template"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={selectedTemplate}
                        onChange={(e) => handleSelectTemplate(e.target.value)}
                      >
                        <option value="">-- 请选择模板 --</option>
                        {templates.map(template => (
                          <option key={template.id} value={template.id}>
                            {template.name} ({template.contentType})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">优先级 (1-10)</Label>
                    <Input
                      id="priority"
                      type="number"
                      min="1"
                      max="10"
                      value={config.priority || 5}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        priority: parseInt(e.target.value) || 5,
                      }))}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 操作按钮 */}
              <div className="flex gap-3">
                <Button onClick={handleAdapt} disabled={loading || !selectedTemplate} className="flex-1">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      适配中...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      开始适配
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleClear} disabled={!result && !error}>
                  <X className="h-4 w-4 mr-2" />
                  清空
                </Button>
              </div>

              {/* 错误信息 */}
              {error && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">适配失败</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                </div>
              )}

              {/* 结果展示 */}
              {showResult && result && (
                <Card className="border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-primary" />
                        适配结果
                      </span>
                      <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="h-4 w-4 mr-2" />
                        导出 JSON
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {result.title && (
                          <div className="space-y-2">
                            <Label>标题</Label>
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-sm font-medium">{result.title}</p>
                            </div>
                          </div>
                        )}
                        {result.author && (
                          <div className="space-y-2">
                            <Label>作者</Label>
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-sm">{result.author}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      {result.content && (
                        <div className="space-y-2">
                          <Label>内容预览</Label>
                          <div className="p-4 bg-muted rounded-lg max-h-96 overflow-y-auto">
                            <pre className="text-sm whitespace-pre-wrap font-mono">
                              {generateContentPreview()}
                            </pre>
                          </div>
                        </div>
                      )}
                      {result.tags && Array.isArray(result.tags) && (
                        <div className="space-y-2">
                          <Label>标签</Label>
                          <div className="flex flex-wrap gap-2">
                            {result.tags.map((tag, index) => (
                              <Badge key={index} variant="secondary">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 pt-4 border-t">
                        <Button size="sm" className="flex-1">
                          <Edit3 className="h-4 w-4 mr-2" />
                          编辑内容
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Save className="h-4 w-4 mr-2" />
                          保存为新内容
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* 模板管理标签页 */}
          <TabsContent value="templates" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">可用模板</h3>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  新建模板
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(template => (
                  <Card key={template.id} className="cursor-pointer hover:border-primary/50 transition-colors">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{template.name}</span>
                        <Badge variant={template.contentType === contentType ? 'default' : 'secondary'}>
                          {template.contentType}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {template.description}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelectTemplate(template.id)}
                          className="flex-1"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          使用模板
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* 历史记录标签页 */}
          <TabsContent value="history" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索历史记录..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  筛选
                </Button>
              </div>
              <div className="space-y-2">
                {history.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>暂无历史记录</p>
                  </div>
                ) : (
                  history.map(record => (
                    <Card key={record.id} className="cursor-pointer hover:border-primary/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant={record.status === 'completed' ? 'default' : 'secondary'}>
                              {record.status === 'completed' ? '成功' : record.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(record.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2 text-sm">
                          <span className="text-muted-foreground">类型:</span>
                          <span className="ml-2">{record.adaptType}</span>
                          <span className="ml-4 text-muted-foreground">目标:</span>
                          <span className="ml-2">{record.targetContentType}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ContentAdaptModal;
