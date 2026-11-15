import { Router } from 'express';
import { parse, parseId } from '../../core/validation.js';
import { customerPaymentSchema } from '../../../shared/schemas/index.js';
import { customerBaseRoutes } from '../masterData/masterDataRoutes.js';
import * as accountService from './customerAccountService.js';

export const customerRoutes = Router();

// Specific paths are registered before the generic "/:id" routes.
customerRoutes.get('/debtors', async (_req, res) => {
  res.json(await accountService.listDebtors());
});

customerRoutes.get('/:id/statement', async (req, res) => {
  res.json(await accountService.getStatement(parseId(req.params.id)));
});

customerRoutes.post('/:id/payments', async (req, res) => {
  res
    .status(201)
    .json(
      await accountService.receivePayment(req.user, parseId(req.params.id), parse(customerPaymentSchema, req.body)),
    );
});

customerRoutes.use('/', customerBaseRoutes);
