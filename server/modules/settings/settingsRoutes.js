import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../../core/validation.js';
import { requireRole } from '../../middleware/auth.js';
import { ROLES } from '../../../shared/constants.js';
import { shopSettingsSchema, listQuerySchema } from '../../../shared/schemas/index.js';
import * as settingsService from './settingsService.js';
import * as backupService from '../backup/backupService.js';
import { listAuditLogs } from '../audit/auditService.js';
import { recordAudit } from '../audit/auditService.js';
import { reinitialiseDatabase } from '../system/startup.js';

const adminOnly = requireRole(ROLES.ADMIN);

export const settingsRoutes = Router();

settingsRoutes.get('/public', async (_req, res) => {
  res.json(await settingsService.getPublicSettings());
});

settingsRoutes.get('/', adminOnly, async (_req, res) => {
  res.json(await settingsService.getSettings());
});

settingsRoutes.put('/', adminOnly, async (req, res) => {
  const settings = await settingsService.updateSettings(parse(shopSettingsSchema, req.body));
  await recordAudit({
    userId: req.user.id,
    action: 'SETTINGS_UPDATED',
    entityType: 'settings',
    summary: 'Updated shop settings',
  });
  res.json(settings);
});

export const backupRoutes = Router();

backupRoutes.use(adminOnly);

backupRoutes.get('/', async (_req, res) => {
  res.json(await backupService.listBackups());
});

backupRoutes.post('/', async (req, res) => {
  const result = await backupService.createBackup('manual');
  await recordAudit({
    userId: req.user.id,
    action: 'BACKUP_CREATED',
    entityType: 'backup',
    summary: `Created backup ${result.fileName}`,
  });
  res.status(201).json(result);
});

const restoreSchema = z
  .object({
    fileName: z.string().max(200).optional(),
    filePath: z.string().max(1000).optional(),
    confirm: z.literal('RESTORE', { error: 'Type RESTORE to confirm' }),
  })
  .refine((v) => v.fileName || v.filePath, { message: 'Select a backup to restore' });

backupRoutes.post('/restore', async (req, res) => {
  const { fileName, filePath, confirm: _confirm } = parse(restoreSchema, req.body);
  const result = await backupService.restoreBackup({ fileName, filePath });
  // A backup from an older version may need newer migrations applied.
  await reinitialiseDatabase();
  await recordAudit({
    userId: req.user.id,
    action: 'BACKUP_RESTORED',
    entityType: 'backup',
    summary: `Restored backup ${result.restoredFrom}`,
  });
  res.json(result);
});

export const auditRoutes = Router();

auditRoutes.use(adminOnly);

auditRoutes.get('/', async (req, res) => {
  const dateParam = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional();
  res.json(await listAuditLogs(parse(listQuerySchema.extend({ from: dateParam, to: dateParam }), req.query)));
});
