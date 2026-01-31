import { Vultisig, MemoryStorage, FastVault, SecureVault } from '@vultisig/sdk';
import { FileStorage } from '../storage/fileStorage.js';
import {
  CreateVaultRequest,
  VaultMetadata,
  CreateSecureVaultRequest,
  SecureVaultSession,
} from '../types/index.js';

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

  async verifyVault(vaultId: string, code: string): Promise<FastVault> {
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
