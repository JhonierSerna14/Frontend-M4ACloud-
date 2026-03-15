import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { Button, Input, Loading } from '@/components/ui'
import { AuthFormLayout } from '@/components/auth/AuthFormLayout'
import { Mail, Lock } from 'lucide-react'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { login } = useAuth()
  const { error } = useNotification()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setIsLoading(true)
    try {
      await login({ email, password })
    } catch (err) {
      error('Error de inicio de sesion', 'Email o contrasena incorrectos')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthFormLayout
      title="Bienvenido de vuelta"
      subtitle="Ingresa a tu cuenta para continuar"
      footer={<>No tienes cuenta?{' '}<Link to="/register" className="text-primary hover:underline">Registrate</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Email</label>
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="pl-9"
              required
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Contrasena</label>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              className="pl-9"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <Loading size="sm" /> : 'Iniciar Sesion'}
        </Button>
      </form>
    </AuthFormLayout>
  )
}
