import { Router, Request, Response } from 'express';
import { VaultService } from '../services/vaultService.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import {
  CreateVaultRequest,
  VerifyVaultRequest,
  GetAddressRequest,
  SignTransactionRequest,
  CreateSecureVaultRequest,
  ApiResponse,
} from '../types/index.js';

export function createVaultRouter(vaultService: VaultService): Router {
  const router = Router();

  /**
   * POST /api/vaults/fast
   * Create a new Fast Vault (2-of-2 MPC)
   */
  router.post(
    '/fast',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as CreateVaultRequest;

      if (!body.name || !body.email || !body.password) {
        throw new AppError('Missing required fields: name, email, password', 400);
      }

      const result = await vaultService.createFastVault(body);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Fast Vault created. Check your email for verification code.',
      };

      res.status(201).json(response);
    })
  );

  /**
   * POST /api/vaults/secure
   * Create a new Secure Vault (N-of-M MPC)
   */
  router.post(
    '/secure',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as CreateSecureVaultRequest;

      if (!body.name || !body.devices || !body.threshold) {
        throw new AppError('Missing required fields: name, devices, threshold', 400);
      }

      if (body.threshold > body.devices) {
        throw new AppError('Threshold cannot exceed number of devices', 400);
      }

      const session = await vaultService.createSecureVault(body);

      const response: ApiResponse = {
        success: true,
        data: session,
        message: 'Secure Vault session created. Scan QR code with Vultisig mobile app.',
      };

      res.status(201).json(response);
    })
  );

  /**
   * POST /api/vaults/:vaultId/verify
   * Verify a vault with email verification code
   */
  router.post(
    '/:vaultId/verify',
    asyncHandler(async (req: Request, res: Response) => {
      const { vaultId } = req.params;
      const { verificationCode } = req.body;

      if (!verificationCode) {
        throw new AppError('Verification code is required', 400);
      }

      await vaultService.verifyVault(vaultId, verificationCode);

      const response: ApiResponse = {
        success: true,
        message: 'Vault verified successfully',
      };

      res.json(response);
    })
  );

  /**
   * GET /api/vaults/:vaultId/address/:chain
   * Get blockchain address for a vault
   */
  router.get(
    '/:vaultId/address/:chain',
    asyncHandler(async (req: Request, res: Response) => {
      const { vaultId, chain } = req.params;

      const address = await vaultService.getAddress(vaultId, chain);

      const response: ApiResponse = {
        success: true,
        data: { chain, address },
      };

      res.json(response);
    })
  );

  /**
   * POST /api/vaults/:vaultId/sign
   * Sign a transaction using MPC
   */
  router.post(
    '/:vaultId/sign',
    asyncHandler(async (req: Request, res: Response) => {
      const { vaultId } = req.params;
      const { transaction, chain, options } = req.body;

      if (!transaction) {
        throw new AppError('Transaction payload is required', 400);
      }

      const signature = await vaultService.signTransaction(
        vaultId,
        transaction,
        options
      );

      const response: ApiResponse = {
        success: true,
        data: { signature },
        message: 'Transaction signed successfully',
      };

      res.json(response);
    })
  );

  /**
   * GET /api/vaults
   * List all vaults (optionally filtered by userId)
   */
  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.query.userId as string | undefined;

      const vaults = await vaultService.listVaults(userId);

      const response: ApiResponse = {
        success: true,
        data: { vaults },
      };

      res.json(response);
    })
  );

  /**
   * GET /api/vaults/:vaultId
   * Get vault metadata
   */
  router.get(
    '/:vaultId',
    asyncHandler(async (req: Request, res: Response) => {
      const { vaultId } = req.params;

      const metadata = await vaultService.getVaultMetadata(vaultId);

      if (!metadata) {
        throw new AppError('Vault not found', 404);
      }

      const response: ApiResponse = {
        success: true,
        data: metadata,
      };

      res.json(response);
    })
  );

  /**
   * POST /api/vaults/:vaultId/export
   * Export vault backup
   */
  router.post(
    '/:vaultId/export',
    asyncHandler(async (req: Request, res: Response) => {
      const { vaultId } = req.params;
      const { password } = req.body;

      if (!password) {
        throw new AppError('Password is required for export', 400);
      }

      const exportData = await vaultService.exportVault(vaultId, password);

      const response: ApiResponse = {
        success: true,
        data: { backup: exportData },
        message: 'Vault exported successfully',
      };

      res.json(response);
    })
  );

  /**
   * GET /api/vaults/:vaultId/session
   * Get secure vault session status
   */
  router.get(
    '/:vaultId/session',
    asyncHandler(async (req: Request, res: Response) => {
      const { vaultId } = req.params;

      const session = vaultService.getSecureVaultSession(vaultId);

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      const response: ApiResponse = {
        success: true,
        data: session,
      };

      res.json(response);
    })
  );

  return router;
}
