import { apiClient } from '@lib/api-client.ts'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { useAuth } from './_provider/auth.tsx'
import AppProviders from './_provider/index.tsx'
import { getQueryClient } from './_provider/tanstack.tsx'
import reportWebVitals from './reportWebVitals.ts'
import { router } from './router.tsx'
import './styles.css'


// Render the app
const rootElement = document.getElementById('app')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)

  root.render(
    <StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </StrictMode>,
  )
}

function App() {
  const authContext = useAuth();
  return (
    <RouterProvider router={router} context={{
      queryClient: getQueryClient(),
      apiClient: apiClient,
      authContext: authContext,
    }} />
  )
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
