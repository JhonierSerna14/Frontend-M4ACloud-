import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useNotification } from '@/context/NotificationContext'
import { Button, Input, Loading } from '@/components/ui'
import { AuthFormLayout } from '@/components/auth/AuthFormLayout'
import { Mail, Lock, User } from 'lucide-react'

export function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { register } = useAuth()
  const { error } = useNotification()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !nombre) return

    setIsLoading(true)
    try {
      await register({ email, password, nombre })
    } catch (err) {
      error('Error al registrar', 'No se pudo crear la cuenta')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthFormLayout
      title="Crear cuenta"
      subtitle="Registrate para empezar a organizar tus notas"
      footer={<>Ya tienes cuenta?{' '}<Link to="/login" className="text-primary hover:underline">Inicia sesion</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Nombre</label>
          <div className="relative mt-1">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Juan Perez"
              className="pl-9"
              required
            />
          </div>
        </div>
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
              minLength={6}
            />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <Loading size="sm" /> : 'Crear cuenta'}
        </Button>
      </form>
    </AuthFormLayout>
  )
}
