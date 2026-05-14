const NETWORKS = {
    mainnet: {
        id: 'mainnet',
        label: 'Mainnet',
        chainId: 31612,
        defaultRpcUrl: 'wss://rpc-ws-internal.mezo.org',
        explorerUrl: 'https://explorer.mezo.org',
    },
    testnet: {
        id: 'testnet',
        label: 'Testnet',
        chainId: 31611,
        defaultRpcUrl: 'https://rpc.test.mezo.org',
        explorerUrl: 'https://explorer.test.mezo.org',
    },
};

const normalizeNetwork = (value) => {
    if (!value) return undefined;
    const normalized = String(value).trim().toLowerCase();

    if (['mainnet', 'live', 'prod', 'production'].includes(normalized)) return 'mainnet';
    if (['testnet', 'matsnet', 'dev', 'development', 'staging'].includes(normalized)) return 'testnet';

    return undefined;
};

const getEnv = (name) => {
    const value = process.env[name];
    return value === undefined || value === '' ? undefined : value;
};

const selectedNetwork =
    normalizeNetwork(getEnv('MEZO_NETWORK')) ||
    normalizeNetwork(getEnv('NODE_ENV')) ||
    'testnet';

const networkConfig = NETWORKS[selectedNetwork];

const rpcUrl =
    getEnv('RPC_URL') ||
    getEnv(`MEZO_${selectedNetwork.toUpperCase()}_RPC_URL`) ||
    networkConfig.defaultRpcUrl;

const poolContractAddress =
    getEnv('POOL_CONTRACT_ADDRESS') ||
    getEnv(`MEZO_${selectedNetwork.toUpperCase()}_POOL_CONTRACT_ADDRESS`);

if (!rpcUrl) {
    throw new Error(
        `Missing RPC URL for Mezo network ${selectedNetwork}. Provide RPC_URL or MEZO_${selectedNetwork.toUpperCase()}_RPC_URL in environment variables.`
    );
}

if (!poolContractAddress) {
    throw new Error(
        `Missing pool contract address for Mezo network ${selectedNetwork}. Provide POOL_CONTRACT_ADDRESS or MEZO_${selectedNetwork.toUpperCase()}_POOL_CONTRACT_ADDRESS in environment variables.`
    );
}

module.exports = {
    network: selectedNetwork,
    chainId: networkConfig.chainId,
    rpcUrl,
    poolContractAddress,
    explorerUrl: networkConfig.explorerUrl,
    networks: NETWORKS,
};
