# Octra CLI

Production-level JavaScript CLI for the [Octra blockchain](https://octrascan.io).

## Install

```bash
cd octra-cli
npm install
npm link  # makes `octra` command available globally
```

## Commands

### Wallet
```bash
octra wallet create              # Create new wallet (12-word mnemonic)
octra wallet import              # Import from mnemonic or private key
octra wallet list                # List all wallets
octra wallet balance [address]   # Show balance
octra wallet info [address]      # Full account info
```

### Transactions
```bash
octra send <to> <amount>         # Send OCTRA
octra send oct1abc... 10.5 -m "payment"
octra batch recipients.json      # Batch send from JSON file
octra tx <hash>                  # Get transaction details
octra history [address]          # Transaction history
octra staging                    # View mempool
```

### FHE (Encrypted Balance)
```bash
octra fhe encrypt <amount>       # Encrypt balance (FHE)
octra fhe decrypt <amount>       # Decrypt balance
octra fhe balance                # Show encrypted balance
octra fhe cipher [address]       # Get raw FHE ciphertext
```

### Stealth Transactions
```bash
octra stealth send <to> <amount> # Stealth send via ECDH
octra stealth scan               # Scan for incoming stealth payments
octra stealth viewkey [address]  # Get view public key
```

### RPC Utilities
```bash
octra rpc status                 # Check node status
octra rpc call <method> [args]   # Raw RPC call
octra rpc contracts              # List deployed contracts
```

## Batch Send Format

`recipients.json`:
```json
[
  { "to": "oct1abc...", "amount": 5.0, "memo": "payment 1" },
  { "to": "oct1xyz...", "amount": 2.5 }
]
```

## RPC Endpoint

Default: `http://46.101.86.250:8080`

Override per command: `--rpc http://your-node:8080`

## Wallet Storage

Wallets are AES-256-GCM encrypted and stored in `~/.octra/wallets/`

## Port to Other Languages

This CLI is structured so the core modules can be ported 1:1:

| JS module | Equivalent in other languages |
|---|---|
| `src/crypto.js` | Rust: `ed25519-dalek` + `bip39` |
| `src/rpc.js` | Any HTTP client |
| `src/tx.js` | Any JSON + sign library |
| `src/wallet-store.js` | AES-256-GCM file encryption |
| `src/commands/` | CLI framework of your choice |
