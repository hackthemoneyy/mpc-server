export type CreateVaultRequest = {
  name: string;
  email: string;
  password: string;
  userId?: string;
};

export type VerifyVaultRequest = {
  vaultId: string;
  verificationCode: string;
};

export type GetAddressRequest = {
  vaultId: string;
  chain: string;
};

export type SignTransactionRequest = {
  vaultId: string;
  chain: string;
  transaction: any;
  password?: string;
};

export type VaultMetadata = {
  vaultId: string;
  name: string;
  email: string;
  userId?: string;
  createdAt: string;
  verified: boolean;
  chains?: string[];
};

export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export type CreateSecureVaultRequest = {
  name: string;
  devices: number;
  threshold: number;
  password?: string;
  userId?: string;
};

export type SecureVaultSession = {
  vaultId: string;
  sessionId: string;
  qrCode: string;
  devicesJoined: number;
  devicesRequired: number;
  status: 'pending' | 'ready' | 'failed';
};
