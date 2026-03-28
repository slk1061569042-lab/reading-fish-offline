import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const baseUrl = import.meta.env.BASE_URL
const routerBasename =
  baseUrl === '/' ? '' : baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
