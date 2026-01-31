# mpc wallet api

rest api for multi-party computation wallets \\w [vultisig sdk](https://www.npmjs.com/package/@vultisig/sdk).

the server holds one piece of the key, your app holds another. neither can spend alone—both have to cooperate. that's the whole point.

## what is this

you want to build a wallet where users don't trust you \\w their private keys? this is how.

the private key never exists in one place. it's split using threshold signatures (TSS). the server is one party, the client is another. to sign a transaction, both parties run a cryptographic protocol together. no single point of failure.

supports 40+ chains: bitcoin, ethereum, solana, polygon, avalanche, arbitrum, cosmos, whatever.

## architecture

```
wallet app  ◄──── mpc protocol ────►  your server
(share 1)                            (share 2)

neither party has the full key
both needed to sign transactions
```

two modes:

**fast vault** — 2-of-2 (server + client)
quick setup, server co-signs instantly. good for most use cases.

**secure vault** — n-of-m (e.g., 2-of-3 devices)
multi-device threshold. no server needed for signing. bulletproof.

## install & run

```bash
npm install
npm run dev
```

server starts on `localhost:3000`. that's it.

## api endpoints

### create wallet
```bash
POST /api/vaults/fast

{
  "name": "my wallet",
  "email": "you@example.com",
  "password": "strong-password"
}

→ returns vaultId
→ sends verification code to email
```

### verify wallet
```bash
POST /api/vaults/:vaultId/verify

{
  "verificationCode": "123456"
}
```

### get address
```bash
GET /api/vaults/:vaultId/address/Bitcoin
GET /api/vaults/:vaultId/address/Ethereum
GET /api/vaults/:vaultId/address/Solana

→ returns blockchain address
```

### sign transaction
```bash
POST /api/vaults/:vaultId/sign

{
  "chain": "Ethereum",
  "transaction": { ... }
}

→ mpc signing happens
→ returns signature
```

### list vaults
```bash
GET /api/vaults?userId=user123
```

### export backup
```bash
POST /api/vaults/:vaultId/export

{
  "password": "backup-password"
}

→ returns encrypted backup (base64)
```

## quick test

```bash
# health check
curl localhost:3000/health

# create a wallet
curl -X POST localhost:3000/api/vaults/fast \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test wallet",
    "email": "test@example.com",
    "password": "Test123!"
  }'

# or use the test script
./examples/test-api.sh

# or the typescript client
npx tsx examples/client.ts
```

## how mpc works

traditional wallet:
- private key stored somewhere
- whoever has it controls everything
- single point of failure

mpc wallet:
- key split into shares using TSS
- shares distributed across parties
- signing requires threshold cooperation (2-of-2, 2-of-3, etc)
- no party ever has complete key
- even if server gets hacked, attacker can't steal funds

this uses vultisig's implementation of DKLS (2-party ECDSA) and schnorr (EdDSA) protocols. the crypto runs in WASM sandbox for security.

## project structure

```
src/
├── server.ts              main express app
├── types/index.ts         typescript types
├── services/
│   └── vaultService.ts    vultisig sdk wrapper
├── storage/
│   └── fileStorage.ts     vault metadata persistence
├── routes/
│   └── vaults.ts          rest endpoints
└── middleware/
    └── errorHandler.ts    error handling

examples/
├── client.ts              typescript client example
└── test-api.sh            bash test script

data/vaults/               vault storage (auto-created)
```

## stack

- node.js + typescript
- express 5
- vultisig sdk (mpc/tss)
- file-based storage (swap to postgres/mongo later if needed)

simple, fast, works.

## integrate \\w your app

```typescript
import { VultisigWalletClient } from './examples/client';

const client = new VultisigWalletClient('http://localhost:3000/api');

// create vault
const { vaultId } = await client.createFastVault(
  'user wallet',
  'user@example.com',
  'password123'
);

// verify
await client.verifyVault(vaultId, '123456');

// get addresses
const btc = await client.getAddress(vaultId, 'Bitcoin');
const eth = await client.getAddress(vaultId, 'Ethereum');

// sign transaction
const sig = await client.signTransaction(vaultId, 'Ethereum', txData);
```

see `examples/client.ts` for full implementation.

## security notes

- server holds one share, can't sign alone
- client holds one share, can't sign alone
- vault backups encrypted \\w user password
- mpc protocols (DKLS/schnorr) proven secure
- crypto operations in WASM sandbox
- file permissions 0600

for production:
- use https (obviously)
- add authentication (jwt or whatever)
- rate limit the api
- maybe swap file storage for postgres
- monitor everything

## 3rd party docs

- [vultisig sdk docs](https://github.com/vultisig/docs/blob/main/developer-docs/vultisig-sdk/README.md)

