// ═══════════════════════════════════════════════════
// Express 应用入口
// ═══════════════════════════════════════════════════

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import config, { validateProductionSecrets } from './config/index.js';
import { error } from './utils/response.js';
import { initializeScheduler } from './jobs/scheduler.js';

// 路由
import authRouter from './routes/auth.js';
import dashboardRouter from './routes/dashboard.js';
import examPlansRouter from './routes/exam-plans.js';
import examNodesRouter from './routes/exam-nodes.js';
import candidatesRouter from './routes/candidates.js';
import prospectiveCandidatesRouter from './routes/prospective-candidates.js';
import aiOpsRouter from './routes/ai-ops.js';
import scoresRouter from './routes/scores.js';
import certificatesRouter from './routes/certificates.js';
import archivesRouter from './routes/archives.js';
import remindersRouter from './routes/reminders.js';
import settingsRouter from './routes/settings.js';
import exportTemplatesRouter from './routes/export-templates.js';
import hqRouter from './routes/hq.js';
import usersRouter from './routes/users.js';

const app = express();

// ─── 中间件 ───
app.use(helmet({
  contentSecurityPolicy: false, // 开发时禁用，生产环境可配置
}));

app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
}));

app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── 静态文件 ───
// 前端构建产物
const frontendDist = path.resolve(process.cwd(), 'dist');
app.use(express.static(frontendDist));

// 上传文件目录
const uploadsDir = path.resolve(process.cwd(), 'data/files');
app.use('/uploads', express.static(uploadsDir));

// ─── API 路由 ───
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/exam-plans', examPlansRouter);
app.use('/api/exam-nodes', examNodesRouter);
app.use('/api/candidates', candidatesRouter);
app.use('/api/prospective-candidates', prospectiveCandidatesRouter);
app.use('/api/ai-ops', aiOpsRouter);
app.use('/api/scores', scoresRouter);
app.use('/api/certificates', certificatesRouter);
app.use('/api/archives', archivesRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/export-templates', exportTemplatesRouter);
app.use('/api/hq', hqRouter);
app.use('/api/users', usersRouter);

// ─── 健康检查 ───
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── API 兜底 ───
app.use('/api', (_req, res) => {
  error(res, 'NOT_FOUND', '接口不存在', 404);
});

// ─── 前端路由回退 ───
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ─── 全局错误处理 ───
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  error(res, 'INTERNAL_ERROR', err.message || '服务器内部错误', 500);
});

// ─── 启动 ───
const PORT = config.PORT;

validateProductionSecrets();

app.listen(PORT, () => {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  考评分支机构管理系统  后端服务已启动`);
  console.log(`  端口: ${PORT}`);
  console.log(`  环境: ${config.NODE_ENV}`);
  console.log(`  API地址: http://localhost:${PORT}/api`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  // 启动定时任务
  initializeScheduler();
});

export default app;
