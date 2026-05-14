/**
 * React Login Component - WalletConnect + Signature Auth
 */

import { useState } from 'react';
import { ethers } from 'ethers';

export function LoginPage({ client, onAuthenticated }) {
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('connect'); // 'connect' | 'sign' | 'done'
  const [message, setMessage] = useState('');
  const [signature, setSignature] = useState('');

  const connectWallet = async () => {
    try {
      setLoading(true);
      setError('');

      if (!window.ethereum) {
        throw new Error('MetaMask not found. Please install it.');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      setWalletAddress(accounts[0]);
      setStep('sign');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getNonce = async () => {
    try {
      setLoading(true);
      setError('');

      const result = await client.auth.getNonce(walletAddress);
      setMessage(result.message);
      setStep('sign');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const signMessage = async () => {
    try {
      setLoading(true);
      setError('');

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const sig = await signer.signMessage(message);
      setSignature(sig);

      // Verify signature with server
      await client.auth.verify(walletAddress, sig, message);
      setStep('done');
      onAuthenticated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h1>🎰 ROYALSTACK</h1>

      {step === 'connect' && (
        <div className="step">
          <p>Connect your wallet to play</p>
          <button onClick={connectWallet} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect MetaMask'}
          </button>
        </div>
      )}

      {step === 'sign' && (
        <div className="step">
          <p>Wallet: {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}</p>
          <button onClick={signMessage} disabled={loading}>
            {loading ? 'Signing...' : 'Sign Message to Login'}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="step success">
          <p>✓ Authenticated!</p>
          <p>{walletAddress}</p>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}

export default LoginPage;
