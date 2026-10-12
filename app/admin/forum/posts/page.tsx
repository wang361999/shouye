'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Grid,
  Avatar,
  Tooltip,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiFetch } from '@/lib/fetch-retry';

interface ForumPost {
  id: string;
  title: string;
  content: string;
  authorName: string;
  authorId: string;
  categoryId: string;
  categoryName?: string;
  status: 'PUBLISHED' | 'DRAFT' | 'DELETED';
  views: number;
  likes: number;
  comments: number;
  createdAt: string;
  updatedAt: string;
}

export default function ForumPostsPage() {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingPost, setEditingPost] = useState<ForumPost | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    categoryId: '',
    status: 'PUBLISHED' as ForumPost['status'],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'deleted'>('all');
  const [token, setToken] = useState('');

  useEffect(() => {
    fetchPosts();
  }, [filter]);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/forum/posts?filter=${filter}`) as ForumPost[];
      setPosts(data);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const handleOpenDialog = (post?: ForumPost) => {
    if (post) {
      setEditingPost(post);
      setFormData({
        title: post.title,
        content: post.content,
        categoryId: post.categoryId || '',
        status: post.status,
      });
    } else {
      setEditingPost(null);
      setFormData({
        title: '',
        content: '',
        categoryId: '',
        status: 'PUBLISHED',
      });
    }
    setOpenDialog(true);
    setError('');
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingPost(null);
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.content) {
      setError('标题和内容不能为空');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const url = editingPost
        ? `/api/forum/posts/${editingPost.id}`
        : '/api/forum/posts';
      
      const method = editingPost ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '操作失败');
      }

      handleCloseDialog();
      fetchPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (post: ForumPost) => {
    const newStatus = post.status === 'PUBLISHED' ? 'DELETED' : 'PUBLISHED';
    try {
      await fetch(`/api/forum/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchPosts();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const deletePost = async (id: string) => {
    if (!confirm('确定要删除这个帖子吗？此操作不可恢复。')) return;

    try {
      await fetch(`/api/forum/posts/${id}`, {
        method: 'DELETE',
      });
      fetchPosts();
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">帖子管理</Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchPosts}
        >
          刷新
        </Button>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <FormControl size="small">
          <InputLabel>筛选</InputLabel>
          <Select
            value={filter}
            label="筛选"
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <MenuItem value="all">全部</MenuItem>
            <MenuItem value="published">已发布</MenuItem>
            <MenuItem value="draft">草稿</MenuItem>
            <MenuItem value="deleted">已删除</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>标题</TableCell>
              <TableCell>作者</TableCell>
              <TableCell>分类</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>浏览</TableCell>
              <TableCell>点赞</TableCell>
              <TableCell>评论</TableCell>
              <TableCell>时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {posts.map((post) => (
              <TableRow key={post.id}>
                <TableCell sx={{ maxWidth: 300 }}>
                  <Typography variant="body2" noWrap>
                    {post.title}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                      {post.authorName[0]}
                    </Avatar>
                    {post.authorName}
                  </Box>
                </TableCell>
                <TableCell>{post.categoryName || post.categoryId}</TableCell>
                <TableCell>
                  <Chip 
                    label={post.status} 
                    size="small" 
                    color={post.status === 'PUBLISHED' ? 'success' : post.status === 'DRAFT' ? 'warning' : 'error'} 
                  />
                </TableCell>
                <TableCell>{post.views}</TableCell>
                <TableCell>{post.likes}</TableCell>
                <TableCell>{post.comments}</TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Tooltip title="编辑">
                    <IconButton size="small" onClick={() => handleOpenDialog(post)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={post.status === 'PUBLISHED' ? '删除' : '发布'}>
                    <IconButton size="small" onClick={() => toggleStatus(post)}>
                      {post.status === 'PUBLISHED' ? <BlockIcon /> : <CheckCircleIcon />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="删除">
                    <IconButton size="small" onClick={() => deletePost(post.id)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingPost ? '编辑帖子' : '添加帖子'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="标题"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="内容"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              fullWidth
              multiline
              rows={8}
              required
            />
            <TextField
              label="分类 ID"
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>状态</InputLabel>
              <Select
                value={formData.status}
                label="状态"
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ForumPost['status'] })}
              >
                <MenuItem value="PUBLISHED">已发布</MenuItem>
                <MenuItem value="DRAFT">草稿</MenuItem>
                <MenuItem value="DELETED">已删除</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={submitting || !formData.title || !formData.content}
          >
            {submitting ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
