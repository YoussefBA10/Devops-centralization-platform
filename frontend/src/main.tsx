import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { EnvironmentProvider } from './context/EnvironmentContext'
import { BrowserRouter } from 'react-router-dom'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <EnvironmentProvider>
          <App />
        </EnvironmentProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
