import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { KofrinhoProvider } from './context/KofrinhoContext'
import Home from './pages/Home'
import LandingPage from './pages/LandingPage'
import KofrinhoDetails from './pages/KofrinhoDetails'
import './App.css'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />
}

function RootRoute() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Home /> : <LandingPage />
}

function AppContent() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route
          path="/kofrinho/:id"
          element={
            <ProtectedRoute>
              <KofrinhoDetails />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function App() {
  return (
    <AuthProvider>
      <KofrinhoProvider>
        <AppContent />
      </KofrinhoProvider>
    </AuthProvider>
  )
}

export default App
