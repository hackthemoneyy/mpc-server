/**
 * VultisigWalletClient - TypeScript client for the MPC Wallet API
 *
 * Usage:
 *   import { VultisigWalletClient } from './client';
 *   const client = new VultisigWalletClient('http://localhost:3000/api');
 *   const { vaultId } = await client.createFastVault('my wallet', 'user@example.com', 'password');
 */

// Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreateVaultResponse {
  vaultId: string;
}

export interface VerifyVaultResponse {
  verified: boolean;
  vaultId: string;
}

export interface AddressResponse {
  address: string;
  chain: string;
  vaultId: string;
}

export interface VaultMetadata {
  vaultId: string;
  name: string;
  email: string;
  userId?: string;
  createdAt: string;
  verified: boolean;
  chains?: string[];
}

export interface ExportResponse {
  backup: string;
  vaultId: string;
}

export interface SignResponse {
  signature: string;
  [key: string]: any;
}

export interface SecureVaultSession {
  vaultId: string;
  sessionId: string;
  qrCode: string;
  devicesJoined: number;
  devicesRequired: number;
  status: 'pending' | 'ready' | 'completed';
}

export type Chain =
  | 'Bitcoin'
  | 'Ethereum'
  | 'Solana'
  | 'Polygon'
  | 'Avalanche'
  | 'Arbitrum'
  | 'Cosmos'
  | string;

// Client class
export class VultisigWalletClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000/api') {
    // Remove trailing slash if present
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed: ${response.status}`);
    }

    // Handle both wrapped and unwrapped responses
    return data.data ?? data;
  }

  /**
   * Create a new Fast Vault (2-of-2 MPC)
   * Sends verification email to the provided address
   */
  async createFastVault(
    name: string,
    email: string,
    password: string,
    userId?: string
  ): Promise<CreateVaultResponse> {
    return this.request<CreateVaultResponse>('POST', '/vaults/fast', {
      name,
      email,
      password,
      userId,
    });
  }

  /**
   * Verify a vault with the code sent to email
   * In TEST_MODE, use code "000000" to bypass verification
   */
  async verifyVault(vaultId: string, verificationCode: string): Promise<VerifyVaultResponse> {
    return this.request<VerifyVaultResponse>('POST', `/vaults/${vaultId}/verify`, {
      verificationCode,
    });
  }

  /**
   * Get blockchain address for a specific chain
   */
  async getAddress(vaultId: string, chain: Chain): Promise<AddressResponse> {
    return this.request<AddressResponse>('GET', `/vaults/${vaultId}/address/${chain}`);
  }

  /**
   * Get addresses for multiple chains
   */
  async getAddresses(vaultId: string, chains: Chain[]): Promise<Map<Chain, string>> {
    const addresses = new Map<Chain, string>();

    await Promise.all(
      chains.map(async (chain) => {
        const { address } = await this.getAddress(vaultId, chain);
        addresses.set(chain, address);
      })
    );

    return addresses;
  }

  /**
   * Sign a transaction using MPC
   */
  async signTransaction(
    vaultId: string,
    chain: Chain,
    transaction: any,
    password?: string
  ): Promise<SignResponse> {
    return this.request<SignResponse>('POST', `/vaults/${vaultId}/sign`, {
      chain,
      transaction,
      password,
    });
  }

  /**
   * List all vaults, optionally filtered by userId
   */
  async listVaults(userId?: string): Promise<VaultMetadata[]> {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const response = await this.request<{ vaults: VaultMetadata[] }>('GET', `/vaults${query}`);
    return response.vaults ?? [];
  }

  /**
   * Get vault metadata by ID
   */
  async getVault(vaultId: string): Promise<VaultMetadata> {
    return this.request<VaultMetadata>('GET', `/vaults/${vaultId}`);
  }

  /**
   * Export vault as encrypted backup
   */
  async exportVault(vaultId: string, password: string): Promise<ExportResponse> {
    return this.request<ExportResponse>('POST', `/vaults/${vaultId}/export`, {
      password,
    });
  }

  /**
   * Create a Secure Vault (N-of-M threshold)
   */
  async createSecureVault(
    name: string,
    devices: number,
    threshold: number,
    password?: string,
    userId?: string
  ): Promise<SecureVaultSession> {
    return this.request<SecureVaultSession>('POST', '/vaults/secure', {
      name,
      devices,
      threshold,
      password,
      userId,
    });
  }

  /**
   * Get secure vault session status
   */
  async getSecureVaultSession(vaultId: string): Promise<SecureVaultSession> {
    return this.request<SecureVaultSession>('GET', `/vaults/${vaultId}/session`);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl.replace('/api', '')}/health`);
    return response.json();
  }
}

// Address validation utilities
export const AddressValidators = {
  bitcoin: (address: string): boolean => {
    // Mainnet: starts with 1, 3, or bc1
    return /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
  },

  ethereum: (address: string): boolean => {
    // 0x followed by 40 hex characters
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  },

  solana: (address: string): boolean => {
    // Base58 encoded, 32-44 characters
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  },

  isValid: (chain: Chain, address: string): boolean => {
    switch (chain.toLowerCase()) {
      case 'bitcoin':
        return AddressValidators.bitcoin(address);
      case 'ethereum':
      case 'polygon':
      case 'avalanche':
      case 'arbitrum':
        return AddressValidators.ethereum(address);
      case 'solana':
        return AddressValidators.solana(address);
      default:
        return address.length > 0;
    }
  },
};

// Export default instance
export default VultisigWalletClient;
