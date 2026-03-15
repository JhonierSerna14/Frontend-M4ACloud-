import type { Editor } from '@tiptap/react'
import {
  Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, CheckSquare,
  AlignLeft, AlignCenter, AlignRight,
  Link, Image, Undo, Redo, ImagePlus
} from 'lucide-react'

interface EditorToolbarProps {
  editor: Editor
  onImageUpload?: () => void
  onImageFromUrl?: () => void
}

export function EditorToolbar({ editor, onImageUpload, onImageFromUrl }: EditorToolbarProps) {
  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL del enlace:', previousUrl)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const ToolButton = ({ onClick, isActive, children, title }: {
    onClick: () => void
    isActive?: boolean
    children: React.ReactNode
    title?: string
  }) => (
    <button
      onClick={onClick}
      title={title}
      className={'p-1.5 rounded transition-colors ' + (isActive ? 'bg-muted text-primary' : 'hover:bg-muted')}
    >
      {children}
    </button>
  )

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-white">
      <ToolButton onClick={() => editor.chain().focus().undo().run()} title="Deshacer">
        <Undo className="h-4 w-4" />
      </ToolButton>
      <ToolButton onClick={() => editor.chain().focus().redo().run()} title="Rehacer">
        <Redo className="h-4 w-4" />
      </ToolButton>
      
      <div className="w-px h-6 bg-border mx-1" />
      
      {/* Heading selector: paragraph / h1 / h2 / h3 */}
      <div className="relative">
        {
          (() => {
            const current = editor.isActive('heading', { level: 1 }) ? 'h1'
              : editor.isActive('heading', { level: 2 }) ? 'h2'
              : editor.isActive('heading', { level: 3 }) ? 'h3' : ''

            return (
              <select
                aria-label="Estilo de texto"
                value={current}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '') {
                    editor.chain().focus().setParagraph().run()
                  } else {
                    const level = Number(v.replace('h', '')) as 1 | 2 | 3
                    editor.chain().focus().toggleHeading({ level }).run()
                  }
                }}
                className={`p-1.5 rounded transition-colors text-sm ${current ? 'bg-muted text-primary' : 'hover:bg-muted'}`}
                title="Estilo de texto"
              >
                <option value="h1">Título</option>
                <option value="h2">Subtítulo 1</option>
                <option value="h3">Subtítulo 2</option>
                <option value="">Texto</option>
              </select>
            )
          })()
        }
      </div>
      
      <div className="w-px h-6 bg-border mx-1" />
      
      <ToolButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Negrita"
      >
        <Bold className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Cursiva"
      >
        <Italic className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Subrayado"
      >
        <Underline className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Tachado"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolButton>
      
      <div className="w-px h-6 bg-border mx-1" />
      
      <ToolButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Lista"
      >
        <List className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Lista numerada"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive('taskList')}
        title="Lista de tareas"
      >
        <CheckSquare className="h-4 w-4" />
      </ToolButton>
      
      <div className="w-px h-6 bg-border mx-1" />
      
      <ToolButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title="Alinear izquierda"
      >
        <AlignLeft className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title="Centrar"
      >
        <AlignCenter className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title="Alinear derecha"
      >
        <AlignRight className="h-4 w-4" />
      </ToolButton>
      
      <div className="w-px h-6 bg-border mx-1" />
      
      <ToolButton onClick={setLink} isActive={editor.isActive('link')} title="Enlace">
        <Link className="h-4 w-4" />
      </ToolButton>
      {onImageUpload && (
        <ToolButton onClick={onImageUpload} title="Subir imagen">
          <Image className="h-4 w-4" />
        </ToolButton>
      )}
      {onImageFromUrl && (
        <ToolButton onClick={onImageFromUrl} title="Imagen desde URL">
          <ImagePlus className="h-4 w-4" />
        </ToolButton>
      )}
    </div>
  )
}
