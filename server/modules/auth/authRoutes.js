import { Router } from 'express';
import { parse } from '../../core/validation.js';
import { loginSchema, changePasswordSchema } from '../../../shared/schemas/index.js';
import { authenticate } from '../../middleware/auth.js';
import * as authService from './authService.js';

export const authRoutes = Router();

authRoutes.post('/login', async (req, res) => {
  res.json(await authService.login(parse(loginSchema, req.body)));
});

authRoutes.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

authRoutes.post('/change-password', authenticate, async (req, res) => {
  res.json(await authService.changePassword(req.user.id, parse(changePasswordSchema, req.body)));
});
