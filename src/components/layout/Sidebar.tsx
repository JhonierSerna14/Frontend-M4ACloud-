import { Link, useLocation } from 'react-router-dom'
import { 
  Home, 
  BookOpen, 
  FileText, 
  CheckSquare, 
  Mic, 
  LogOut,
  Menu,
  X,
  Plus,
  Archive,
  ChevronDown
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSemestre } from '@/context/SemestreContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import { CrearSemestreModal } from '@/components/semestre/CrearSemestreModal'

const navigation = [
  { name: 'Inicio', href: '/', icon: Home },
  { name: 'Materias', href: '/materias', icon: BookOpen },
  { name: 'Notas', href: '/notas', icon: FileText },
  { name: 'Tareas', href: '/tareas', icon: CheckSquare },
  { name: 'Grabar', href: '/grabar', icon: Mic }
]

export function Sidebar() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const { semestreActual, semestres, esEditable, cambiarSemestre, isChanging } = useSemestre()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [semestreOpen, setSemestreOpen] = useState(false)
  const [createSemestreOpen, setCreateSemestreOpen] = useState(false)

  const handleSemestreChange = async (semestreId: number) => {
    if (semestreId === semestreActual?.id) {
      setSemestreOpen(false)
      return
    }
    await cambiarSemestre(semestreId)
    setSemestreOpen(false)
  }

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 border-b">
        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-lg">M4A</span>
        </div>
        <div className="flex flex-col">
          <span className="font-semibold">M4A</span>
          <span className="text-xs text-muted-foreground">Mis Apuntes</span>
        </div>
      </div>

      {/* Semester selector */}
      <div className="px-3 py-3 border-b">
        <div className="relative">
          <button
            onClick={() => setSemestreOpen(!semestreOpen)}
            disabled={isChanging}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors text-sm"
          >
            <div className="flex items-center gap-2 min-w-0">
              {!esEditable && <Archive className="h-4 w-4 text-amber-600 shrink-0" />}
              <div className="text-left min-w-0">
                <p className="font-medium truncate">{semestreActual?.codigo || '...'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {esEditable ? 'Semestre activo' : 'Viendo archivo'}
                </p>
              </div>
            </div>
            <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', semestreOpen && 'rotate-180')} />
          </button>

          {semestreOpen && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg overflow-hidden">
              {semestres.map((semestre) => (
                <button
                  key={semestre.id}
                  onClick={() => handleSemestreChange(semestre.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors',
                    semestre.id === semestreActual?.id && 'bg-primary/10 font-medium'
                  )}
                >
                  <span>{semestre.codigo}</span>
                  {semestre.nombre && (
                    <span className="text-muted-foreground ml-1">· {semestre.nombre}</span>
                  )}
                  {!semestre.es_editable && (
                    <span className="text-xs text-amber-600 ml-1">(archivo)</span>
                  )}
                </button>
              ))}
              <button
                onClick={() => { setSemestreOpen(false); setCreateSemestreOpen(true) }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-muted border-t transition-colors"
              >
                <Plus className="h-4 w-4" />
                Nuevo semestre
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/' && location.pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-medium">
              {user?.nombre?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.nombre}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full justify-start" 
          onClick={logout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar sesión
        </Button>
      </div>
    </>
  )

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <>
      <CrearSemestreModal
        isOpen={createSemestreOpen}
        onClose={() => setCreateSemestreOpen(false)}
      />

      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-background border shadow-sm"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-background shadow-lg flex flex-col">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
            <NavContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-background border-r">
        <NavContent />
      </aside>
    </>
  )
}
