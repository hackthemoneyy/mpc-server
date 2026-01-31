import { Vultisig, MemoryStorage, FastVault, SecureVault } from '@vultisig/sdk';
import { FileStorage } from '../storage/fileStorage.js';
import {
  CreateVaultRequest,
  VaultMetadata,
  CreateSecureVaultRequest,
  SecureVaultSession,
} from '../types/index.js';

const isTestMode = process.env.TEST_MODE === 'true';
const TEST_VERIFICATION_CODE = '000000';

// Mock vault for TEST_MODE - generates deterministic test addresses
class TestVault {
  private vaultId: string;

  constructor(vaultId: string) {
    this.vaultId = vaultId;
  }

  async address(chain: string): Promise<string> {
    // Generate deterministic test addresses based on vaultId
    const hash = this.vaultId.replace(/-/g, '').slice(0, 16).padEnd(16, '0');
    switch (chain.toLowerCase()) {
      case 'bitcoin':
        return `bc1qtest${hash}0000000000000000`;
      case 'ethereum':
        return `0x${hash}000000000000000000000000`;
      case 'solana':
        return `Test${hash}SolanaAddress12345678`;
      case 'polygon':
        return `0x${hash}000000000000000000000000`;
      case 'avalanche':
        return `0x${hash}000000000000000000000000`;
      case 'arbitrum':
        return `0x${hash}000000000000000000000000`;
      default:
        return `test-${chain.toLowerCase()}-${hash}`;
    }
  }

  async sign(_payload: any, _options?: any): Promise<any> {
    throw new Error('Signing is not available in TEST_MODE. Use real verification for signing operations.');
  }

  async exportAsBase64(password: string): Promise<string> {
    // Return a mock base64 encoded export
    const mockExport = {
      vaultId: this.vaultId,
      testMode: true,
      exportedAt: new Date().toISOString(),
      password: password ? '[protected]' : undefined,
    };
    return Buffer.from(JSON.stringify(mockExport)).toString('base64');
  }

  // Add 'export' property so the 'export' in vault check passes
  async export(password: string): Promise<string> {
    return this.exportAsBase64(password);
  }
}

export class VaultService {
  private sdk: Vultisig;
  private storage: FileStorage;
  private vaults: Map<string, FastVault | SecureVault> = new Map();
  private secureVaultSessions: Map<string, SecureVaultSession> = new Map();

  constructor(storage: FileStorage) {
    this.storage = storage;
    this.sdk = new Vultisig({ storage: new MemoryStorage() });
  }

  async initialize(): Promise<void> {
    await this.sdk.initialize();
    await this.storage.initialize();
    if (isTestMode) {
      console.log('⚠️  WARNING: Running in TEST_MODE - verification bypass enabled');
      console.log(`   Use code "${TEST_VERIFICATION_CODE}" to verify vaults without real email`);
    }
    console.log('VaultService initialized');
  }

  async createFastVault(request: CreateVaultRequest): Promise<{ vaultId: string }> {
    const vaultId = await this.sdk.createFastVault({
      name: request.name,
      email: request.email,
      password: request.password,
    });

    const metadata: VaultMetadata = {
      vaultId,
      name: request.name,
      email: request.email,
      userId: request.userId,
      createdAt: new Date().toISOString(),
      verified: false,
    };

    await this.storage.saveVaultMetadata(metadata);

    return { vaultId };
  }

  async verifyVault(vaultId: string, code: string): Promise<FastVault | TestVault> {
    // TEST_MODE bypass: use code "000000" to skip real verification
    if (isTestMode && code === TEST_VERIFICATION_CODE) {
      console.log(`⚠️  TEST_MODE: Bypassing verification for vault ${vaultId}`);

      const metadata = await this.storage.getVaultMetadata(vaultId);
      if (!metadata) {
        throw new Error('Vault not found');
      }

      await this.storage.updateVaultMetadata(vaultId, { verified: true });

      const testVault = new TestVault(vaultId);
      this.vaults.set(vaultId, testVault as any);

      return testVault;
    }

    // Normal verification flow
    const vault = await this.sdk.verifyVault(vaultId, code);

    await this.storage.updateVaultMetadata(vaultId, { verified: true });

    this.vaults.set(vaultId, vault);

    return vault;
  }

  async getAddress(vaultId: string, chain: string): Promise<string> {
    let vault = this.vaults.get(vaultId);

    if (!vault) {
      const metadata = await this.storage.getVaultMetadata(vaultId);
      if (!metadata || !metadata.verified) {
        throw new Error('Vault not found or not verified');
      }
      throw new Error('Vault not loaded. Please re-verify the vault first.');
    }

    const address = await vault.address(chain);

    const metadata = await this.storage.getVaultMetadata(vaultId);
    if (metadata) {
      const chains = new Set(metadata.chains || []);
      chains.add(chain);
      await this.storage.updateVaultMetadata(vaultId, {
        chains: Array.from(chains),
      });
    }

    return address;
  }

  async signTransaction(
    vaultId: string,
    transactionPayload: any,
    options?: any
  ): Promise<any> {
    const vault = this.vaults.get(vaultId);

    if (!vault) {
      throw new Error('Vault not loaded. Please verify the vault first.');
    }

    const result = await vault.sign(transactionPayload, options);
    return result;
  }

  async exportVault(vaultId: string, password: string): Promise<string> {
    const vault = this.vaults.get(vaultId);

    if (!vault) {
      throw new Error('Vault not loaded');
    }

    if (!('export' in vault)) {
      throw new Error('Vault does not support export');
    }

    const exportData = await (vault as any).exportAsBase64(password);
    await this.storage.saveVaultExport(vaultId, exportData);

    return exportData;
  }

  async listVaults(userId?: string): Promise<VaultMetadata[]> {
    return await this.storage.listVaults(userId);
  }

  async getVaultMetadata(vaultId: string): Promise<VaultMetadata | null> {
    return await this.storage.getVaultMetadata(vaultId);
  }

  async createSecureVault(request: CreateSecureVaultRequest): Promise<SecureVaultSession> {
    let qrCodeData = '';
    let currentSession: SecureVaultSession = {
      vaultId: '',
      sessionId: '',
      qrCode: '',
      devicesJoined: 0,
      devicesRequired: request.devices,
      status: 'pending',
    };

    const { vault, vaultId, sessionId } = await this.sdk.createSecureVault({
      name: request.name,
      devices: request.devices,
      threshold: request.threshold,
      password: request.password,
      onQRCodeReady: (qrPayload) => {
        qrCodeData = qrPayload;
        currentSession.qrCode = qrPayload;
      },
      onDeviceJoined: (deviceId, totalJoined, required) => {
        currentSession.devicesJoined = totalJoined;
        if (totalJoined === required) {
          currentSession.status = 'ready';
        }
      },
      onProgress: (step) => {
        console.log(`Secure vault progress: ${step.step} - ${step.message}`);
      },
    });

    currentSession.vaultId = vaultId;
    currentSession.sessionId = sessionId;

    this.secureVaultSessions.set(vaultId, currentSession);

    const metadata: VaultMetadata = {
      vaultId,
      name: request.name,
      email: '',
      userId: request.userId,
      createdAt: new Date().toISOString(),
      verified: true,
    };

    await this.storage.saveVaultMetadata(metadata);

    this.vaults.set(vaultId, vault);

    return currentSession;
  }

  getSecureVaultSession(vaultId: string): SecureVaultSession | undefined {
    return this.secureVaultSessions.get(vaultId);
  }
}
