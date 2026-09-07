'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Switch,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/admin/ui/index';
import { RefreshCw, Check, X, Trash2, Plus, Loader2, AlertTriangle, ExternalLink, Copy, Download, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '@/lib/i18n/client';
import { useAdminStore } from '@/lib/admin-store';

interface AdaptItem {
  id: string;
  type: 'product' | 'tool' | 'doc';
  originalTitle: string;
  adaptedTitle: string;
  originalContent: string;
  adaptedContent: string;
  status: 'pending' | 'adapting' | 'success' | 'error';
  error?: string;
}

export function ContentAdaptModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { admin } = useAdminStore();
  
  const [items, setItems] = useState<AdaptItem[]>([]);
  const [isAdapting, setIsAdapting] = useState(false);
  const [sourceType, setSourceType] = useState<'api' | 'upload'>('api');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 模拟API密钥
  const MOCK_API_KEY = 'mock-api-key';

  useEffect(() => {
    if (open) {
      loadItems();
    }
  }, [open]);

  const loadItems = async () => {
    setLoading(true);
    try {
      // 模拟从API获取内容列表
      const mockItems: AdaptItem[] = [
        {
          id: '1',
          type: 'product',
          originalTitle: 'Next.js Dashboard Template',
          adaptedTitle: '',
          originalContent: 'A comprehensive dashboard template built with Next.js 14...',
          adaptedContent: '',
          status: 'pending',
        },
        {
          id: '2',
          type: 'tool',
          originalTitle: 'AI Code Reviewer',
          adaptedTitle: '',
          originalContent: 'An AI-powered code review tool that analyzes pull requests...',
          adaptedContent: '',
          status: 'pending',
        },
        {
          id: '3',
          type: 'doc',
          originalTitle: 'Getting Started with React',
          adaptedTitle: '',
          originalContent: 'Learn the fundamentals of React development...',
          adaptedContent: '',
          status: 'pending',
        },
      ];
      
      setItems(mockItems);
    } catch (error) {
      toast.error('Failed to load content items');
    } finally {
      setLoading(false);
    }
  };

  const handleAdapt = async (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'adapting' } : item
    ));

    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 2000));

    setItems(prev => prev.map(item => 
      item.id === id ? { 
        ...item, 
        status: 'success',
        adaptedTitle: `${item.originalTitle} (Adapted)`,
        adaptedContent: `This is an adapted version of: ${item.originalContent}`,
      } : item
    ));

    toast.success('Content adapted successfully');
  };

  const handleAdaptAll = async () => {
    setIsAdapting(true);
    
    for (const item of items) {
      if (item.status === 'pending' || item.status === 'error') {
        await handleAdapt(item.id);
      }
    }
    
    setIsAdapting(false);
    toast.success('All content adapted successfully');
  };

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    toast.success('Item deleted');
  };

  const handleExport = () => {
    const data = items.map(item => ({
      originalTitle: item.originalTitle,
      adaptedTitle: item.adaptedTitle,
      originalContent: item.originalContent,
      adaptedContent: item.adaptedContent,
      status: item.status,
    }));
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'adapted-content.json';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Content exported');
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (Array.isArray(data)) {
          setItems(data.map((item, index) => ({
            id: `uploaded-${index}`,
            type: item.type || 'product',
            originalTitle: item.originalTitle,
            adaptedTitle: item.adaptedTitle || '',
            originalContent: item.originalContent,
            adaptedContent: item.adaptedContent || '',
            status: item.status || 'pending',
          })));
          toast.success(`Uploaded ${data.length} items`);
        }
      } catch (error) {
        toast.error('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('admin.contentAdapt.title')}</DialogTitle>
          <DialogDescription>
            {t('admin.contentAdapt.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* API Key Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.contentAdapt.apiConfig')}</CardTitle>
              <CardDescription>
                {t('admin.contentAdapt.apiKeyDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setSourceType('api')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    sourceType === 'api'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {t('admin.contentAdapt.useApi')}
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('upload')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    sourceType === 'upload'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {t('admin.contentAdapt.uploadJson')}
                </button>
              </div>

              {sourceType === 'api' && (
                <div className="space-y-2">
                  <Label htmlFor="apiKey">{t('admin.contentAdapt.apiKey')}</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="apiKey"
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your API key"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => setShowApiKey(!showApiKey)}
                      type="button"
                    >
                      {showApiKey ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                </div>
              )}

              {sourceType === 'upload' && (
                <div className="space-y-2">
                  <Label>{t('admin.contentAdapt.uploadFile')}</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {t('admin.contentAdapt.selectFile')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Content List */}
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.contentAdapt.contentList')}</CardTitle>
              <CardDescription>
                {t('admin.contentAdapt.contentListDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('admin.contentAdapt.noContent')}
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge variant="secondary">
                              {item.type}
                            </Badge>
                            <Badge variant={
                              item.status === 'success' ? 'default' :
                              item.status === 'adapting' ? 'secondary' :
                              item.status === 'error' ? 'destructive' :
                              'outline'
                            }>
                              {item.status}
                            </Badge>
                          </div>
                          <h4 className="font-semibold">{item.originalTitle}</h4>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {item.originalContent}
                          </p>
                          {item.adaptedContent && (
                            <p className="text-sm text-primary mt-2 line-clamp-2">
                              {item.adaptedContent}
                            </p>
                          )}
                          {item.error && (
                            <p className="text-sm text-destructive mt-2">
                              {item.error}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          {item.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => handleAdapt(item.id)}
                              disabled={isAdapting}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              {t('admin.contentAdapt.adapt')}
                            </Button>
                          )}
                          {item.status === 'adapting' && (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          )}
                          {item.status === 'success' && (
                            <Check className="w-4 h-4 text-green-500" />
                          )}
                          {item.status === 'error' && (
                            <X className="w-4 h-4 text-destructive" />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="text-sm text-muted-foreground">
                {t('admin.contentAdapt.totalItems', { count: items.length })}
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={handleExport}
                  disabled={items.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('admin.contentAdapt.export')}
                </Button>
                <Button
                  onClick={handleAdaptAll}
                  disabled={isAdapting || items.length === 0}
                >
                  {isAdapting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('admin.contentAdapt.adapting')}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {t('admin.contentAdapt.adaptAll')}
                    </>
                  )}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
