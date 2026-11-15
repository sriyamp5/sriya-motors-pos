import { Router } from 'express';
import { parse, parseId } from '../../core/validation.js';
import {
  listQuerySchema,
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
} from '../../../shared/schemas/index.js';
import * as userService from './userService.js';

export const userRoutes = Router();

userRoutes.get('/', async (req, res) => {
  res.json(await userService.listUsers(parse(listQuerySchema, req.query)));
});

userRoutes.get('/:id', async (req, res) => {
  res.json(await userService.getUser(parseId(req.params.id)));
});

userRoutes.post('/', async (req, res) => {
  res.status(201).json(await userService.createUser(req.user, parse(createUserSchema, req.body)));
});

userRoutes.put('/:id', async (req, res) => {
  res.json(await userService.updateUser(req.user, parseId(req.params.id), parse(updateUserSchema, req.body)));
});

userRoutes.post('/:id/reset-password', async (req, res) => {
  await userService.resetPassword(req.user, parseId(req.params.id), parse(resetPasswordSchema, req.body));
  res.status(204).end();
});
