import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safely catch and suppress errors and benign warnings from browser extensions (e.g. MetaMask inpage.js)
// and WebGL shader compiler ANGLE info warnings in iframe / preview sandboxes
if (typeof window !== 'undefined') {
  // 1. Synchronous error event interceptor (e.g., inpage.js thrown errors)
  window.addEventListener(
    'error',
    (event) => {
      const errorMsg = event?.message || String(event?.error?.message || '');
      const filename = event?.filename || '';
      if (
        errorMsg.includes('MetaMask') ||
        errorMsg.includes('Failed to connect to MetaMask') ||
        filename.includes('inpage.js') ||
        filename.includes('nkbihfbeogaeaoehlefnkodbefgpgknn') ||
        filename.includes('chrome-extension://')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
    },
    true
  );

  // 2. Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const errorMsg = event?.reason?.message || String(event?.reason || '');
    if (
      errorMsg.includes('MetaMask') ||
      errorMsg.includes('inpage.js') ||
      errorMsg.includes('Failed to connect to MetaMask') ||
      errorMsg.includes('nkbihfbeogaeaoehlefnkodbefgpgknn') ||
      errorMsg.includes('chrome-extension://') ||
      errorMsg.includes('AudioContext')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  // 3. Filter benign shader compiler warnings and extension logs
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const text = args.map((a) => (typeof a === 'string' ? a : (a as { message?: string })?.message || String(a))).join(' ');
    if (
      text.includes('warning X4122') ||
      text.includes('cannot be represented accurately in double precision') ||
      text.includes('THREE.Clock: This module has been deprecated') ||
      text.includes('Failed to connect to MetaMask') ||
      text.includes('inpage.js')
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(<App />);
