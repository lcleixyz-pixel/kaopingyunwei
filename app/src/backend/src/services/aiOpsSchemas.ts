import { z } from 'zod';

const safeFileName = z
  .string()
  .trim()
  .min(1, '文件名不能为空')
  .refine((value) => !/[\\/]/.test(value), '文件名不能包含路径');

export const restoreBackupSchema = z.object({
  backupId: safeFileName.refine((value) => value.endsWith('.db'), '仅支持恢复 .db 备份文件'),
});

export const downloadFileQuerySchema = z.object({
  file: safeFileName.refine((value) => value.endsWith('.db') || value.endsWith('.tar.gz'), '仅支持下载备份文件或迁移包'),
});

export const logsQuerySchema = z.object({
  lines: z.coerce.number().int('日志行数必须是整数').min(1, '日志行数至少为 1').max(500, '日志行数最多为 500').default(100),
});
