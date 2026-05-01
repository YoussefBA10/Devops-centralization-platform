import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { ClusterProvider } from './context/ClusterContext'
import { EnvironmentProvider } from './context/EnvironmentContext'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ClusterProvider>
            <EnvironmentProvider>
              <App />
            </EnvironmentProvider>
          </ClusterProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
