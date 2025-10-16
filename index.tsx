// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    {/* HashRouter avoids refresh/route issues inside Android WebView */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
