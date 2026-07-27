import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { appQueryClient } from './app/query-client';
import { ToastProvider } from './components';
import { AuthProvider, initializeAuthTransport } from './features/auth';
import './styles/index.css';

initializeAuthTransport();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider onSessionCleared={() => appQueryClient.clear()}>
      <QueryClientProvider client={appQueryClient}>
        <BrowserRouter>
          <ToastProvider>
            <App />
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </AuthProvider>
  </StrictMode>,
);
