# ROYALSTACK

## Prerequisites

- Node.js >= 18
- Git

## Getting Started

```bash
git clone https://github.com/16navigabraham/ROYALSTACK
cd ROYALSTACK
```

## Project Structure

```
ROYALSTACK/
├── client/          # Frontend
├── server/          # Backend API
└── smart-contract/  # Solidity contracts
```

## Development

Each folder is an independent workspace. Navigate into the one you're working on:

```bash
cd client
npm install
npm run dev
```

```bash
cd server
npm install
npm run dev
```

```bash
cd smart-contract
npm install
```

## Working on a Specific Part (Sparse Checkout)

If you only need one folder:

```bash
git clone --filter=blob:none --sparse https://github.com/16navigabraham/ROYALSTACK
cd ROYALSTACK
git sparse-checkout set server   # or: client, smart-contract
```
