import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { NotificationProvider } from '@/context/NotificationContext'
import { MainLayout } from '@/components/layout'
import { Loading } from '@/components/ui'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import ProcessingRestorer from '@/components/ProcessingRestorer'

const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const MateriasPage = lazy(() => import('@/pages/MateriasPage').then((m) => ({ default: m.MateriasPage })))
const NotasPage = lazy(() => import('@/pages/NotasPage').then((m) => ({ default: m.NotasPage })))
const NotaEditorPage = lazy(() => import('@/pages/NotaEditorPage').then((m) => ({ default: m.NotaEditorPage })))
const TareasPage = lazy(() => import('@/pages/TareasPage').then((m) => ({ default: m.TareasPage })))
const GrabarPage = lazy(() => import('@/pages/GrabarPage').then((m) => ({ default: m.GrabarPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes in cache
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false
    }
  }
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    )
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    )
  }
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }
  
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loading size="lg" /></div>}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } />
        <Route path="/register" element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        } />
        
        {/* Protected routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DashboardPage />} />
          <Route path="materias" element={<MateriasPage />} />
          <Route path="notas" element={<NotasPage />} />
          <Route path="notas/nueva" element={<NotaEditorPage />} />
          <Route path="notas/:id" element={<NotaEditorPage />} />
          <Route path="tareas" element={<TareasPage />} />
          <Route path="tareas/:id" element={<TareasPage />} />
          <Route path="grabar" element={<GrabarPage />} />
        </Route>
        
        {/* Catch all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
              <ProcessingRestorer />
              <AppRoutes />
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
