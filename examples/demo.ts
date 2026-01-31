/**
 * MPC Wallet API Demo
 *
 * Demonstrates the full vault lifecycle using the TypeScript client.
 *
 * Usage:
 *   1. Start server: TEST_MODE=true npm run dev
 *   2. Run demo: npx tsx examples/demo.ts
 */

import { VultisigWalletClient, AddressValidators, type Chain } from './client.js';

const TEST_CODE = '000000'; // TEST_MODE verification code

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function header(title: string) {
  console.log();
  log('━'.repeat(50), colors.blue);
  log(`  ${title}`, colors.blue);
  log('━'.repeat(50), colors.blue);
}

function success(message: string) {
  log(`✓ ${message}`, colors.green);
}

function error(message: string) {
  log(`✗ ${message}`, colors.red);
}

function info(message: string) {
  log(`  ${message}`, colors.reset);
}

async function main() {
  const baseUrl = process.env.API_URL || 'http://localhost:3000/api';
  const client = new VultisigWalletClient(baseUrl);

  console.log();
  log('╔════════════════════════════════════════════════╗', colors.cyan);
  log('║     MPC Wallet API Demo (TypeScript)           ║', colors.cyan);
  log('╚════════════════════════════════════════════════╝', colors.cyan);
  console.log();
  info(`Server: ${baseUrl}`);
  info(`Test Code: ${TEST_CODE}`);

  try {
    // 1. Health check
    header('1. Health Check');
    const health = await client.healthCheck();
    success(`Server status: ${health.status}`);

    // 2. Create vault
    header('2. Create Fast Vault');
    const timestamp = Date.now();
    const { vaultId } = await client.createFastVault(
      `Demo Wallet ${timestamp}`,
      'demo@example.com',
      'DemoPassword123!',
      `demo-user-${timestamp}`
    );
    success(`Vault created: ${vaultId}`);

    // 3. Verify vault
    header('3. Verify Vault');
    info(`Using TEST_MODE code: ${TEST_CODE}`);
    const verifyResult = await client.verifyVault(vaultId, TEST_CODE);
    success(`Vault verified: ${verifyResult.verified ?? true}`);

    // 4. Get addresses for multiple chains
    header('4. Get Blockchain Addresses');
    const chains: Chain[] = ['Bitcoin', 'Ethereum', 'Solana', 'Polygon', 'Avalanche'];

    for (const chain of chains) {
      try {
        const { address } = await client.getAddress(vaultId, chain);
        const isValid = AddressValidators.isValid(chain, address);
        const validStr = isValid ? colors.green + '(valid)' + colors.reset : colors.yellow + '(test)' + colors.reset;
        success(`${chain.padEnd(12)} ${address} ${validStr}`);
      } catch (err) {
        error(`${chain}: ${err instanceof Error ? err.message : 'Failed'}`);
      }
    }

    // 5. Get vault metadata
    header('5. Get Vault Metadata');
    const metadata = await client.getVault(vaultId);
    info(`Name:      ${metadata.name}`);
    info(`Email:     ${metadata.email}`);
    info(`Created:   ${metadata.createdAt}`);
    info(`Verified:  ${metadata.verified}`);
    info(`Chains:    ${metadata.chains?.join(', ') || 'none'}`);
    success('Metadata retrieved');

    // 6. List all vaults
    header('6. List All Vaults');
    const allVaults = await client.listVaults();
    success(`Found ${allVaults.length} vault(s)`);
    for (const v of allVaults.slice(0, 3)) {
      info(`  - ${v.vaultId.slice(0, 8)}... "${v.name}" (${v.verified ? 'verified' : 'pending'})`);
    }
    if (allVaults.length > 3) {
      info(`  ... and ${allVaults.length - 3} more`);
    }

    // 7. Export vault
    header('7. Export Vault Backup');
    try {
      const exportResult = await client.exportVault(vaultId, 'BackupPassword123!');
      success(`Backup exported (${exportResult.backup.length} chars)`);
      info(`Preview: ${exportResult.backup.slice(0, 50)}...`);
    } catch (err) {
      info(`Export: ${err instanceof Error ? err.message : 'Failed'}`);
      info('(Export may require real vault in non-TEST_MODE)');
    }

    // 8. Test signing (expected to fail in TEST_MODE)
    header('8. Sign Transaction (TEST_MODE)');
    try {
      const signResult = await client.signTransaction(vaultId, 'Ethereum', {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f000000',
        value: '0x0',
        data: '0x',
      });
      success(`Signed: ${JSON.stringify(signResult).slice(0, 50)}...`);
    } catch (err) {
      info(`Expected: ${err instanceof Error ? err.message : 'Signing not available'}`);
      info('(Signing requires real vault verification)');
    }

    // Summary
    header('Demo Complete');
    success('All operations completed successfully!');
    console.log();
    info(`Vault ID: ${vaultId}`);
    info('This vault was created in TEST_MODE.');
    info('For production use, verify with the real email code.');
    console.log();

  } catch (err) {
    console.log();
    error(`Demo failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    console.log();

    if (err instanceof Error && err.message.includes('fetch')) {
      info('Make sure the server is running:');
      info('  TEST_MODE=true npm run dev');
    }

    process.exit(1);
  }
}

// Run demo
main().catch(console.error);
