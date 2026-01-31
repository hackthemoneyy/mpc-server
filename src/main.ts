import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;
// const VAULTS_STORAGE_PATH = process.env.VAULTS_STORAGE_PATH || './data/vaults';

async function startServer() {
  const app: Express = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Vultisig MPC Wallet API',
    });
  });

  app.get('/', (req: Request, res: Response) => {
    res.json({
      name: 'vultisig MPC Wallet REST API',
      version: '1.0.0',
      description: 'MCP wallet API powered by Vultisig SDK',
      endpoints: {
        health: 'GET /health',
        vaults: {
          createFast: 'POST /api/vaults/fast',
          createSecure: 'POST /api/vaults/secure',
          verify: 'POST /api/vaults/:vaultId/verify',
          list: 'GET /api/vaults',
          get: 'GET /api/vaults/:vaultId',
          getAddress: 'GET /api/vaults/:vaultId/address/:chain',
          sign: 'POST /api/vaults/:vaultId/sign',
          export: 'POST /api/vaults/:vaultId/export',
          getSession: 'GET /api/vaults/:vaultId/session',
        },
      },
      docs: 'see README.md for detailed API documentation',
    });
  });

  app.listen(PORT, () => {
    console.log(`server running on: http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('failed to start server:', error);
  process.exit(1);
});
