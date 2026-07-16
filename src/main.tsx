import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { startAutoSync } from './db/sync';
import { migrateDataIfNeeded } from './db/database';
import { AuthProvider } from './contexts/AuthContext';
import { FarmProvider } from './contexts/FarmContext';

migrateDataIfNeeded().then(() => {
  startAutoSync(30000);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <FarmProvider>
        <App />
      </FarmProvider>
    </AuthProvider>
  </React.StrictMode>,
);
