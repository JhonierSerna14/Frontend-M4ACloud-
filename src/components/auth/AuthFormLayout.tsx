import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'

interface AuthFormLayoutProps {
  title: string
  subtitle: string
  children: React.ReactNode
  footer: React.ReactNode
}

export function AuthFormLayout({ title, subtitle, children, footer }: AuthFormLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4">
            <span className="text-primary-foreground font-bold text-xl">M4</span>
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <p className="text-muted-foreground">{subtitle}</p>
        </CardHeader>
        <CardContent>
          {children}
          <p className="text-center text-sm text-muted-foreground mt-6">
            {footer}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
