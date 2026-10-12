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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiFetch } from '@/lib/fetch-retry';

interface ForumReport {
  id: string;
  type: 'spam' | 'abuse' | 'inappropriate' | 'other';
  content: string;
  reporterName: string;
  reporterId: string;
  targetPostId?: string;
  targetCommentId?: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  createdAt: string;
}

export default function ForumReportsPage() {
  const [reports, setReports] = useState<ForumReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingReport, setEditingReport] = useState<ForumReport | null>(null);
  const [formData, setFormData] = useState({
    status: 'pending' as ForumReport['status'],
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed' | 'dismissed'>('all');
  const [token, setToken] = useState('');

  useEffect(() => {
    fetchReports();
  }, [filter]);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/forum/reports?filter=${filter}`) as ForumReport[];
      setReports(data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const handleOpenDialog = (report?: ForumReport) => {
    if (report) {
      setEditingReport(report);
      setFormData({
        status: report.status,
        notes: report.notes || '',
      });
    } else {
      setEditingReport(null);
      setFormData({
        status: 'pending',
        notes: '',
      });
    }
    setOpenDialog(true);
    setError('');
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingReport(null);
  };

  const handleSubmit = async () => {
    if (!editingReport) return;

    try {
      setSubmitting(true);
      setError('');

      const response = await fetch(`/api/forum/reports/${editingReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '操作失败');
      }

      handleCloseDialog();
      fetchReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const updateReport = async (report: ForumReport) => {
    try {
      await fetch(`/api/forum/reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: report.status }),
      });
      fetchReports();
    } catch (err) {
      console.error('Failed to update report:', err);
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
        <Typography variant="h4">举报管理</Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchReports}
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
            <MenuItem value="pending">待处理</MenuItem>
            <MenuItem value="reviewed">已处理</MenuItem>
            <MenuItem value="dismissed">已驳回</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>类型</TableCell>
              <TableCell>举报内容</TableCell>
              <TableCell>举报人</TableCell>
              <TableCell>目标</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>举报时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell>
                  <Chip label={report.type} size="small" />
                </TableCell>
                <TableCell sx={{ maxWidth: 200 }}>
                  <Typography variant="body2" noWrap>
                    {report.content}
                  </Typography>
                </TableCell>
                <TableCell>{report.reporterName}</TableCell>
                <TableCell>
                  {report.targetPostId ? `帖子#${report.targetPostId}` : 
                   report.targetCommentId ? `评论#${report.targetCommentId}` : '-'}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={report.status} 
                    size="small" 
                    color={report.status === 'pending' ? 'warning' : 'success'} 
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Tooltip title="处理举报">
                    <IconButton size="small" onClick={() => handleOpenDialog(report)}>
                      <CheckCircleIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          处理举报
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>处理状态</InputLabel>
              <Select
                value={formData.status}
                label="处理状态"
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ForumReport['status'] })}
              >
                <MenuItem value="pending">待处理</MenuItem>
                <MenuItem value="reviewed">已处理</MenuItem>
                <MenuItem value="dismissed">已驳回</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="处理备注"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={submitting}
          >
            {submitting ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
