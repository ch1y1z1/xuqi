import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import 'allo-font/friendly'
import './styles.css'
import App from './App'
import { SessionProvider } from '@/auth/session'
import { DemoLedgerProvider } from '@/demo/DemoLedgerContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 20_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <DemoLedgerProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </DemoLedgerProvider>
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
)
