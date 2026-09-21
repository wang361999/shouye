'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Box,
  Typography,
  Chip,
  Divider,
  Stack,
  useTheme,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import DescriptionIcon from '@mui/icons-material/Description';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import CodeIcon from '@mui/icons-material/Code';
import LinkIcon from '@mui/icons-material/Link';
import ImageIcon from '@mui/icons-material/Image';
import TableChartIcon from '@mui/icons-material/TableChart';
import { createClient } from '@/lib/supabase/client';

// 工具类型定义
export interface ToolCard {
  id: string;
  title: string;
  description: string;
  url: string;
  category?: string;
  tags?: string[];
  hot?: boolean;
}

export interface ForumPost {
  id: string;
  title: string;
  content: string;
  authorName?: string;
  createdAt?: string;
  categorySlug?: string;
  tags?: string[];
  views?: number;
  likes?: number;
  comments?: number;
}

export interface ToolCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  sortOrder?: number;
  parent_id?: string | null;
  children?: ToolCategory[];
  tool_count?: number;
}

// 工具分类树数据结构
export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  level: number;
  children?: CategoryNode[];
  checked: boolean;
  parent?: CategoryNode;
  forceAddToParent?: boolean;
}

// AI模型配置
export interface AIModelConfig {
  model: string;
  label: string;
  default: boolean;
}

// 适配器接口
export interface AdaptAdapter {
  id: string;
  label: string;
  description: string;
  icon?: string;
  defaultModel?: string;
  config?: Record<string, unknown>;
}

// 工具卡片模板
interface TemplateCard {
  id: string;
  title: string;
  layout: 'simple' | 'detailed' | 'compact';
  showTags?: boolean;
  showDesc?: boolean;
  showUrl?: boolean;
}

// 帖子模板
interface TemplatePost {
  id: string;
  title: string;
  hasIntro?: boolean;
  hasConclusion?: boolean;
  hasCta?: boolean;
}

// 格式化选项
interface FormatOptions {
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
  list?: 'bullet' | 'number';
}

// ContentAdaptModalProps 接口
interface ContentAdaptModalProps {
  open: boolean;
  onClose: () => void;
  selectedItems: Array<
    | { type: 'tool'; item: ToolCard }
    | { type: 'post'; item: ForumPost }
    | { type: 'category'; item: ToolCategory }
  >;
  onSuccess?: (type: string, adaptedItems: unknown[]) => void;
}

// 默认AI模型配置
const DEFAULT_AI_MODELS: AIModelConfig[] = [
  {
    model: 'qwen3-235b-a22b',
    label: 'Qwen3-235B',
    default: true,
  },
  {
    model: 'qwen3-30b-a3b',
    label: 'Qwen3-30B',
    default: false,
  },
  {
    model: 'deepseek-v3.2',
    label: 'DeepSeek-V3.2',
    default: false,
  },
  {
    model: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    default: false,
  },
  {
    model: 'claude-3-haiku',
    label: 'Claude 3 Haiku',
    default: false,
  },
];

// 默认适配器配置
const DEFAULT_ADAPTERS: AdaptAdapter[] = [
  {
    id: 'tool-category',
    label: '工具->分类',
    description: '将工具转换为分类信息',
    icon: '📁',
    defaultModel: 'qwen3-235b-a22b',
  },
  {
    id: 'post-to-tool',
    label: '帖子->工具',
    description: '从帖子中提取工具信息',
    icon: '🔧',
    defaultModel: 'qwen3-235b-a22b',
  },
  {
    id: 'tool-to-post',
    label: '工具->帖子',
    description: '将工具信息转换为论坛帖子',
    icon: '📝',
    defaultModel: 'qwen3-235b-a22b',
  },
  {
    id: 'category-to-tool',
    label: '分类->工具',
    description: '将分类信息转换为工具列表',
    icon: '🛠️',
    defaultModel: 'qwen3-235b-a22b',
  },
];

// 默认模板配置
const DEFAULT_TOOL_TEMPLATES: TemplateCard[] = [
  {
    id: 'simple',
    title: '简洁模板',
    layout: 'simple',
    showTags: true,
    showDesc: false,
    showUrl: true,
  },
  {
    id: 'detailed',
    title: '详细模板',
    layout: 'detailed',
    showTags: true,
    showDesc: true,
    showUrl: true,
  },
  {
    id: 'compact',
    title: '紧凑模板',
    layout: 'compact',
    showTags: false,
    showDesc: true,
    showUrl: false,
  },
];

const DEFAULT_POST_TEMPLATES: TemplatePost[] = [
  {
    id: 'standard',
    title: '标准模板',
    hasIntro: true,
    hasConclusion: true,
    hasCta: true,
  },
  {
    id: 'simple',
    title: '简洁模板',
    hasIntro: false,
    hasConclusion: false,
    hasCta: false,
  },
  {
    id: 'marketing',
    title: '营销模板',
    hasIntro: true,
    hasConclusion: true,
    hasCta: true,
  },
];

// 默认格式化选项
const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
  align: 'left',
  bold: false,
  italic: false,
  list: 'bullet',
};

export default function ContentAdaptModal({
  open,
  onClose,
  selectedItems,
  onSuccess,
}: ContentAdaptModalProps) {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedAdapter, setSelectedAdapter] = useState('tool-category');
  const [aiModels, setAiModels] = useState<AIModelConfig[]>(DEFAULT_AI_MODELS);
  const [adapters, setAdapters] = useState<AdaptAdapter[]>(DEFAULT_ADAPTERS);
  const [loading, setLoading] = useState(false);
  const [adaptResult, setAdaptResult] = useState<unknown[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // 适配器配置状态
  const [adapterConfigs, setAdapterConfigs] = useState<Record<string, Record<string, unknown>>>({});
  const [selectedModel, setSelectedModel] = useState('qwen3-235b-a22b');
  const [customPrompt, setCustomPrompt] = useState('');
  
  // 模板配置状态
  const [toolTemplates, setToolTemplates] = useState<TemplateCard[]>(DEFAULT_TOOL_TEMPLATES);
  const [selectedToolTemplate, setSelectedToolTemplate] = useState('simple');
  const [postTemplates, setPostTemplates] = useState<TemplatePost[]>(DEFAULT_POST_TEMPLATES);
  const [selectedPostTemplate, setSelectedPostTemplate] = useState('standard');
  
  // 格式化选项状态
  const [formatOptions, setFormatOptions] = useState<FormatOptions>(DEFAULT_FORMAT_OPTIONS);
  
  // 预览状态
  const [previewContent, setPreviewContent] = useState<string>('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  
  // 批量操作状态
  const [bulkAction, setBulkAction] = useState<'save' | 'publish' | 'draft'>('save');
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  
  // 历史记录状态
  const [historyItems, setHistoryItems] = useState<Array<{
    id: string;
    type: string;
    adapter: string;
    timestamp: string;
    preview: string;
  }>>([]);
  
  // 分类选择状态
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categorySearch, setCategorySearch] = useState('');
  
  // 加载AI模型配置
  useEffect(() => {
    loadAIModels();
  }, []);
  
  // 加载适配器配置
  useEffect(() => {
    loadAdapters();
  }, []);
  
  // 加载分类树
  useEffect(() => {
    if (open && selectedItems.some(item => item.type === 'tool')) {
      loadCategoryTree();
    }
  }, [open, selectedItems]);
  
  // 从数据库加载AI模型配置
  const loadAIModels = async () => {
    try {
      const response = await fetch('/api/admin/ai-models');
      if (response.ok) {
        const data = await response.json();
        if (data.models && data.models.length > 0) {
          setAiModels(data.models.map((m: any) => ({
            model: m.id,
            label: m.name,
            default: m.priority === 1,
          })));
        }
      }
    } catch (error) {
      console.error('Failed to load AI models:', error);
    }
  };
  
  // 从数据库加载适配器配置
  const loadAdapters = async () => {
    try {
      const response = await fetch('/api/admin/content-adapt/adapters');
      if (response.ok) {
        const data = await response.json();
        if (data.adapters && data.adapters.length > 0) {
          setAdapters(data.adapters);
        }
      }
    } catch (error) {
      console.error('Failed to load adapters:', error);
    }
  };
  
  // 加载分类树
  const loadCategoryTree = async () => {
    try {
      const response = await fetch('/api/tools/categories');
      if (response.ok) {
        const data = await response.json();
        if (data.categories) {
          const tree = buildCategoryTree(data.categories);
          setCategoryTree(tree);
        }
      }
    } catch (error) {
      console.error('Failed to load category tree:', error);
    }
  };
  
  // 构建分类树
  const buildCategoryTree = (categories: ToolCategory[]): CategoryNode[] => {
    const nodeMap = new Map<string, CategoryNode>();
    const roots: CategoryNode[] = [];
    
    // 创建所有节点
    categories.forEach((cat) => {
      nodeMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        level: 0,
        checked: false,
        parent: undefined,
        forceAddToParent: false,
      });
    });
    
    // 建立父子关系
    categories.forEach((cat) => {
      const node = nodeMap.get(cat.id)!;
      if (cat.parent_id) {
        const parent = nodeMap.get(cat.parent_id);
        if (parent) {
          node.level = parent.level + 1;
          node.parent = parent;
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    });
    
    // 应用搜索过滤
    if (categorySearch) {
      const searchResults = new Set<string>();
      const searchInTree = (nodes: CategoryNode[]) => {
        nodes.forEach((node) => {
          if (node.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
              node.slug.toLowerCase().includes(categorySearch.toLowerCase())) {
            searchResults.add(node.id);
            // 添加所有父节点
            let parent = node.parent;
            while (parent) {
              searchResults.add(parent.id);
              parent = parent.parent;
            }
          }
          if (node.children) {
            searchInTree(node.children);
          }
        });
      };
      searchInTree(roots);
      
      // 过滤树
      const filterTree = (nodes: CategoryNode[]): CategoryNode[] => {
        return nodes.filter((node) => {
          const matches = searchResults.has(node.id);
          if (node.children) {
            const filteredChildren = filterTree(node.children);
            if (filteredChildren.length > 0) {
              return true;
            }
          }
          return matches;
        }).map((node) => ({
          ...node,
          children: node.children ? filterTree(node.children) : undefined,
        }));
      };
      
      return filterTree(roots);
    }
    
    return roots;
  };
  
  // 切换分类展开状态
  const toggleCategoryExpand = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);
  
  // 处理分类勾选
  const handleCategoryCheck = useCallback((node: CategoryNode) => {
    const toggleNodeCheck = (n: CategoryNode): boolean => {
      if (n.id === node.id) {
        return !n.checked;
      }
      if (n.children) {
        n.children = n.children.map(toggleNodeCheck);
      }
      return n.checked;
    };
    
    const updateCheckedStatus = (nodes: CategoryNode[]): CategoryNode[] => {
      return nodes.map(n => {
        if (n.children) {
          const updatedChildren = updateCheckedStatus(n.children);
          const allChecked = updatedChildren.every(c => c.checked);
          const someChecked = updatedChildren.some(c => c.checked);
          return {
            ...n,
            children: updatedChildren,
            checked: allChecked ? true : someChecked ? 'indeterminate' as any : false,
          };
        }
        return n;
      });
    };
    
    setCategoryTree(prev => updateCheckedStatus(prev.map(n => 
      n.id === node.id ? { ...n, checked: !n.checked } : n
    )));
  }, []);
  
  // 搜索分类
  const handleCategorySearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCategorySearch(e.target.value);
  };
  
  // 清除分类搜索
  const clearCategorySearch = () => {
    setCategorySearch('');
  };
  
  // 执行内容适配
  const handleAdapt = async () => {
    if (!selectedAdapter) {
      setError('请选择适配器');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // 准备请求数据
      const requestData = {
        adapterId: selectedAdapter,
        items: selectedItems,
        model: selectedModel,
        prompt: customPrompt,
        template: activeTab === 0 ? {
          id: selectedToolTemplate,
          ...toolTemplates.find(t => t.id === selectedToolTemplate),
        } : activeTab === 1 ? {
          id: selectedPostTemplate,
          ...postTemplates.find(t => t.id === selectedPostTemplate),
        } : undefined,
        formatOptions,
        categoryIds: selectedCategories,
        config: adapterConfigs[selectedAdapter],
      };
      
      // 调用适配API
      const response = await fetch('/api/admin/content-adapt/adapt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setAdaptResult(data.result);
      setPreviewContent(JSON.stringify(data.result, null, 2));
      
      // 添加到历史记录
      const historyItem = {
        id: Date.now().toString(),
        type: selectedAdapter,
        adapter: adapters.find(a => a.id === selectedAdapter)?.label || selectedAdapter,
        timestamp: new Date().toLocaleString(),
        preview: JSON.stringify(data.result).slice(0, 100) + '...',
      };
      setHistoryItems(prev => [historyItem, ...prev.slice(0, 9)]);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '适配失败');
      setAdaptResult(null);
    } finally {
      setLoading(false);
    }
  };
  
  // 批量执行内容适配
  const handleBulkAdapt = async () => {
    if (!selectedAdapter || selectedItems.length === 0) {
      setError('请选择适配器和至少一个项目');
      return;
    }
    
    setLoading(true);
    setError(null);
    setBulkProgress(0);
    setBulkTotal(selectedItems.length);
    
    try {
      const results: unknown[] = [];
      
      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        
        // 准备单个项目的请求数据
        const requestData = {
          adapterId: selectedAdapter,
          items: [item],
          model: selectedModel,
          prompt: customPrompt,
          template: activeTab === 0 ? {
            id: selectedToolTemplate,
            ...toolTemplates.find(t => t.id === selectedToolTemplate),
          } : activeTab === 1 ? {
            id: selectedPostTemplate,
            ...postTemplates.find(t => t.id === selectedPostTemplate),
          } : undefined,
          formatOptions,
          categoryIds: selectedCategories,
          config: adapterConfigs[selectedAdapter],
        };
        
        // 调用适配API
        const response = await fetch('/api/admin/content-adapt/adapt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        results.push(...data.result);
        
        // 更新进度
        setBulkProgress(i + 1);
      }
      
      setAdaptResult(results);
      setPreviewContent(JSON.stringify(results, null, 2));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量适配失败');
      setAdaptResult(null);
    } finally {
      setLoading(false);
      setBulkProgress(0);
      setBulkTotal(0);
    }
  };
  
  // 复制结果
  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);
  
  // 导出结果
  const handleExport = useCallback((format: 'json' | 'csv' | 'md') => {
    if (!adaptResult) return;
    
    let content = '';
    let filename = `content-adapt-${Date.now()}.${format}`;
    
    if (format === 'json') {
      content = JSON.stringify(adaptResult, null, 2);
    } else if (format === 'csv') {
      // 简化处理，假设是对象数组
      if (Array.isArray(adaptResult) && adaptResult.length > 0) {
        const headers = Object.keys(adaptResult[0] as Record<string, unknown>).join(',');
        const rows = (adaptResult as Record<string, unknown>[]).map(row => 
          Object.values(row).join(',')
        );
        content = [headers, ...rows].join('\n');
      }
    } else if (format === 'md') {
      content = adaptResult.map((item, index) => 
        `## 结果 ${index + 1}\n\n${JSON.stringify(item, null, 2)}`
      ).join('\n\n');
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [adaptResult]);
  
  // 保存结果
  const handleSave = useCallback(async () => {
    if (!adaptResult) return;
    
    try {
      const response = await fetch('/api/admin/content-adapt/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: selectedAdapter,
          items: adaptResult,
          action: bulkAction,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      onSuccess?.(selectedAdapter, adaptResult);
      onClose();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }, [adaptResult, selectedAdapter, bulkAction, onSuccess, onClose]);
  
  // 删除历史记录
  const handleDeleteHistory = useCallback((id: string) => {
    setHistoryItems(prev => prev.filter(item => item.id !== id));
  }, []);
  
  // 加载历史记录
  const handleLoadHistory = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/admin/content-adapt/history/${id}`);
      if (response.ok) {
        const data = await response.json();
        setAdaptResult(data.result);
        setPreviewContent(JSON.stringify(data.result, null, 2));
      }
    } catch (error) {
      setError('加载历史记录失败');
    }
  }, []);
  
  // 清理历史记录
  const handleClearHistory = useCallback(() => {
    setHistoryItems([]);
  }, []);
  
  // 渲染分类树
  const renderCategoryTree = (nodes: CategoryNode[], level: number = 0) => {
    return nodes.map((node) => (
      <Box key={node.id}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            padding: 1,
            marginLeft: `${level * 20}px`,
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          {node.children && node.children.length > 0 && (
            <IconButton
              size="small"
              onClick={() => toggleCategoryExpand(node.id)}
              sx={{ marginRight: 0.5 }}
            >
              {expandedCategories.has(node.id) ? '▼' : '▶'}
            </IconButton>
          )}
          <Checkbox
            checked={node.checked}
            onChange={() => handleCategoryCheck(node)}
            indeterminate={typeof node.checked === 'string'}
            sx={{ marginRight: 0.5 }}
          />
          <Typography variant="body2">{node.name}</Typography>
        </Box>
        {expandedCategories.has(node.id) && node.children && (
          renderCategoryTree(node.children, level + 1)
        )}
      </Box>
    ));
  };
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'hidden',
        }
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <DialogTitle>
          内容适配转换器
          {selectedItems.length > 0 && (
            <Chip 
              label={`${selectedItems.length} 项已选中`} 
              size="small" 
              sx={{ marginLeft: 1 }}
            />
          )}
        </DialogTitle>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>
      
      <DialogContent dividers>
        {/* 顶部选项卡 */}
        <Tabs 
          value={activeTab} 
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ mb: 2 }}
        >
          <Tab label="工具转分类" />
          <Tab label="帖子转工具" />
          <Tab label="工具转帖子" />
          <Tab label="分类转工具" />
        </Tabs>
        
        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {/* 主内容区域 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {/* 左侧：配置区 */}
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              适配配置
            </Typography>
            
            {/* 适配器选择 */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>适配器</InputLabel>
              <Select
                value={selectedAdapter}
                label="适配器"
                onChange={(e) => setSelectedAdapter(e.target.value)}
              >
                {adapters.map((adapter) => (
                  <MenuItem key={adapter.id} value={adapter.id}>
                    {adapter.icon} {adapter.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {/* AI模型选择 */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>AI模型</InputLabel>
              <Select
                value={selectedModel}
                label="AI模型"
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {aiModels.map((model) => (
                  <MenuItem key={model.model} value={model.model}>
                    {model.label}
                    {model.default && <Chip label="默认" size="small" sx={{ marginLeft: 1 }} />}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {/* 自定义提示词 */}
            <TextField
              fullWidth
              multiline
              rows={4}
              label="自定义提示词"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="输入自定义提示词，留空使用默认模板..."
              sx={{ mb: 2 }}
            />
            
            {/* 模板选择（根据当前tab显示不同模板） */}
            {activeTab === 0 && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>工具模板</InputLabel>
                <Select
                  value={selectedToolTemplate}
                  label="工具模板"
                  onChange={(e) => setSelectedToolTemplate(e.target.value)}
                >
                  {toolTemplates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      {template.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            
            {activeTab === 1 && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>帖子模板</InputLabel>
                <Select
                  value={selectedPostTemplate}
                  label="帖子模板"
                  onChange={(e) => setSelectedPostTemplate(e.target.value)}
                >
                  {postTemplates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      {template.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            
            {/* 格式化选项 */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                格式化选项
              </Typography>
              <Stack direction="row" spacing={1} useSpacer flexWrap="wrap">
                <IconButton
                  size="small"
                  color={formatOptions.align === 'left' ? 'primary' : 'default'}
                  onClick={() => setFormatOptions({ ...formatOptions, align: 'left' })}
                >
                  <FormatAlignLeftIcon />
                </IconButton>
                <IconButton
                  size="small"
                  color={formatOptions.align === 'center' ? 'primary' : 'default'}
                  onClick={() => setFormatOptions({ ...formatOptions, align: 'center' })}
                >
                  <FormatAlignCenterIcon />
                </IconButton>
                <IconButton
                  size="small"
                  color={formatOptions.align === 'right' ? 'primary' : 'default'}
                  onClick={() => setFormatOptions({ ...formatOptions, align: 'right' })}
                >
                  <FormatAlignRightIcon />
                </IconButton>
                <IconButton
                  size="small"
                  color={formatOptions.bold ? 'primary' : 'default'}
                  onClick={() => setFormatOptions({ ...formatOptions, bold: !formatOptions.bold })}
                >
                  <FormatBoldIcon />
                </IconButton>
                <IconButton
                  size="small"
                  color={formatOptions.italic ? 'primary' : 'default'}
                  onClick={() => setFormatOptions({ ...formatOptions, italic: !formatOptions.italic })}
                >
                  <FormatItalicIcon />
                </IconButton>
                <IconButton
                  size="small"
                  color={formatOptions.list === 'bullet' ? 'primary' : 'default'}
                  onClick={() => setFormatOptions({ ...formatOptions, list: 'bullet' })}
                >
                  <FormatListBulletedIcon />
                </IconButton>
                <IconButton
                  size="small"
                  color={formatOptions.list === 'number' ? 'primary' : 'default'}
                  onClick={() => setFormatOptions({ ...formatOptions, list: 'number' })}
                >
                  <FormatListNumberedIcon />
                </IconButton>
              </Stack>
            </Box>
            
            {/* 分类选择（仅工具转分类和分类转工具时显示） */}
            {(activeTab === 0 || activeTab === 3) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  目标分类
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="搜索分类..."
                  value={categorySearch}
                  onChange={handleCategorySearch}
                  sx={{ mb: 1 }}
                  InputProps={{
                    endAdornment: categorySearch && (
                      <IconButton onClick={clearCategorySearch} size="small">
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ),
                  }}
                />
                <Box 
                  sx={{ 
                    maxHeight: 200, 
                    overflow: 'auto', 
                    border: 1, 
                    borderColor: 'divider', 
                    borderRadius: 1,
                    p: 1
                  }}
                >
                  {renderCategoryTree(categoryTree)}
                </Box>
              </Box>
            )}
            
            {/* 批量操作选项 */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                批量操作
              </Typography>
              <FormControl fullWidth>
                <InputLabel>操作类型</InputLabel>
                <Select
                  value={bulkAction}
                  label="操作类型"
                  onChange={(e) => setBulkAction(e.target.value as 'save' | 'publish' | 'draft')}
                >
                  <MenuItem value="save">保存为草稿</MenuItem>
                  <MenuItem value="publish">直接发布</MenuItem>
                  <MenuItem value="draft">保存草稿</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            {/* 执行按钮 */}
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button
                variant="contained"
                onClick={handleAdapt}
                disabled={loading || !selectedAdapter}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
              >
                执行适配
              </Button>
              {selectedItems.length > 1 && (
                <Button
                  variant="outlined"
                  onClick={handleBulkAdapt}
                  disabled={loading || !selectedAdapter}
                  startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
                >
                  批量适配
                </Button>
              )}
            </Stack>
            
            {/* 批量进度 */}
            {loading && bulkTotal > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  处理中: {bulkProgress}/{bulkTotal}
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={(bulkProgress / bulkTotal) * 100} 
                />
              </Box>
            )}
          </Box>
          
          {/* 右侧：预览区 */}
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1">
                预览结果
              </Typography>
              {adaptResult && (
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleExport('json')}
                  >
                    导出JSON
                  </Button>
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleExport('csv')}
                  >
                    导出CSV
                  </Button>
                  <Button
                    size="small"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                  >
                    保存
                  </Button>
                </Stack>
              )}
            </Box>
            
            {isPreviewing ? (
              <Box sx={{ position: 'relative', minHeight: 300 }}>
                <pre
                  style={{
                    background: theme.palette.background.paper,
                    padding: theme.spacing(2),
                    borderRadius: theme.shape.borderRadius,
                    overflow: 'auto',
                    maxHeight: 400,
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  {previewContent}
                </pre>
                <IconButton
                  size="small"
                  sx={{ position: 'absolute', top: 8, right: 8 }}
                  onClick={() => handleCopy('preview', previewContent)}
                >
                  {copiedId === 'preview' ? <CheckIcon /> : <ContentCopyIcon />}
                </IconButton>
              </Box>
            ) : (
              <Box
                sx={{
                  minHeight: 300,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: theme.palette.background.paper,
                  borderRadius: theme.shape.borderRadius,
                }}
              >
                {loading ? (
                  <CircularProgress />
                ) : adaptResult ? (
                  <Typography color="text.secondary">
                    适配完成，共 {Array.isArray(adaptResult) ? adaptResult.length : 0} 条结果
                  </Typography>
                ) : (
                  <Typography color="text.secondary">
                    等待适配结果...
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </Box>
        
        {/* 历史记录 */}
        {historyItems.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              历史记录
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Button
                size="small"
                onClick={handleClearHistory}
                startIcon={<DeleteIcon />}
              >
                清空历史
              </Button>
            </Stack>
            <Box
              sx={{
                maxHeight: 200,
                overflow: 'auto',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              {historyItems.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: 1,
                    borderBottom: 1,
                    borderColor: 'divider',
                    '&:last-child': {
                      borderBottom: 'none',
                    },
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2">
                      {item.adapter} - {item.type}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.timestamp}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mx: 2 }}>
                    {item.preview}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleLoadHistory(item.id)}
                  >
                    <DescriptionIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteHistory(item.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">
          关闭
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!adaptResult || loading}
          startIcon={<SaveIcon />}
        >
          保存到数据库
        </Button>
      </DialogActions>
    </Dialog>
  );
}
