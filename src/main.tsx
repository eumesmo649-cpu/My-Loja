import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { StoreProvider } from './store/StoreContext'
import { UIProvider } from './store/UIContext'
import { watchSystemTheme } from './lib/theme'
import { LockProvider } from './store/LockContext'

watchSystemTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <LockProvider>
        <UIProvider>
          <App />
        </UIProvider>
      </LockProvider>
    </StoreProvider>
  </StrictMode>,
)
