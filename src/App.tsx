import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { NotificationProvider } from '@/context/NotificationContext'
import { MainLayout } from '@/components/layout'
import { Loading } from '@/components/ui'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import ProcessingRestorer from '@/components/ProcessingRestorer'
import { getCacheRevalidatedEventName } from '@/services/browserCache'
import { startCrudSyncBridge } from '@/services/crudSync'

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
      refetchOnMount: true
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

function CacheRevalidationBridge() {
  useEffect(() => {
    const eventName = getCacheRevalidatedEventName()

    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<{
        key?: string
        value?: unknown
      }>

      const key = customEvent.detail?.key
      const value = customEvent.detail?.value
      if (!key) return

      if (key === 'dashboard:summary' && value) {
        queryClient.setQueryData(['dashboard'], value)
        return
      }

      if (key.startsWith('nota:') && value) {
        const id = Number(key.split(':')[1])
        if (Number.isFinite(id)) {
          queryClient.setQueryData(['nota', id], value)
        }
        return
      }

      if (key.startsWith('notas:list:')) {
        queryClient.invalidateQueries({ queryKey: ['notas'], refetchType: 'active' })
      }
    }

    window.addEventListener(eventName, listener)
    return () => window.removeEventListener(eventName, listener)
  }, [])

  return null
}

function CrudSyncBridge() {
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) return
    return startCrudSyncBridge(queryClient, import.meta.env.DEV)
  }, [isAuthenticated])

  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <CacheRevalidationBridge />
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
              <CrudSyncBridge />
              <ProcessingRestorer />
              <AppRoutes />
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
