import fs from 'fs/promises';
import path from 'path';
import { VaultMetadata } from '../types/index.js';

export class FileStorage {
  private storagePath: string;

  constructor(storagePath: string = './data/vaults') {
    this.storagePath = storagePath;
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
      console.log(`Storage initialized at: ${this.storagePath}`);
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  async saveVaultMetadata(metadata: VaultMetadata): Promise<void> {
    const filePath = path.join(this.storagePath, `${metadata.vaultId}.meta.json`);
    await fs.writeFile(filePath, JSON.stringify(metadata, null, 2), 'utf-8');
  }

  async getVaultMetadata(vaultId: string): Promise<VaultMetadata | null> {
    try {
      const filePath = path.join(this.storagePath, `${vaultId}.meta.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as VaultMetadata;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async listVaults(userId?: string): Promise<VaultMetadata[]> {
    try {
      const files = await fs.readdir(this.storagePath);
      const metaFiles = files.filter(f => f.endsWith('.meta.json'));

      const vaults = await Promise.all(
        metaFiles.map(async (file) => {
          const data = await fs.readFile(path.join(this.storagePath, file), 'utf-8');
          return JSON.parse(data) as VaultMetadata;
        })
      );

      if (userId) {
        return vaults.filter(v => v.userId === userId);
      }

      return vaults;
    } catch (error) {
      console.error('Failed to list vaults:', error);
      return [];
    }
  }

  async updateVaultMetadata(vaultId: string, updates: Partial<VaultMetadata>): Promise<void> {
    const metadata = await this.getVaultMetadata(vaultId);
    if (!metadata) {
      throw new Error(`Vault ${vaultId} not found`);
    }

    const updated = { ...metadata, ...updates };
    await this.saveVaultMetadata(updated);
  }

  async deleteVault(vaultId: string): Promise<void> {
    const filePath = path.join(this.storagePath, `${vaultId}.meta.json`);
    await fs.unlink(filePath);
  }

  async saveVaultExport(vaultId: string, exportData: string): Promise<void> {
    const filePath = path.join(this.storagePath, `${vaultId}.vault.backup`);
    await fs.writeFile(filePath, exportData, 'utf-8');
  }

  async getVaultExport(vaultId: string): Promise<string | null> {
    try {
      const filePath = path.join(this.storagePath, `${vaultId}.vault.backup`);
      return await fs.readFile(filePath, 'utf-8');
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}
