import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { ResizableImage } from './ResizableImage'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'

import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { useEffect, useCallback, useState, useRef } from 'react'
import { EditorToolbar } from './EditorToolbar'
import { Loader2 } from 'lucide-react'

interface RichTextEditorProps {
  content: string // HTML content
  onChange: (content: string) => void // Returns HTML
  placeholder?: string
  onImageUpload?: (file: File) => Promise<string>
  editable?: boolean
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Escribe aqui...',
  onImageUpload,
  editable = true
}: RichTextEditorProps) {
  const [isUploading, setIsUploading] = useState(false)
  
  // Handler para subir imagen con estado de carga
  const handleImageUpload = useCallback(async (file: File): Promise<string | null> => {
    if (!onImageUpload) return null
    
    setIsUploading(true)
    try {
      const url = await onImageUpload(file)
      return url
    } catch (error) {
      console.error('Error uploading image:', error)
      return null
    } finally {
      setIsUploading(false)
    }
  }, [onImageUpload])
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      ResizableImage.configure({
        HTMLAttributes: { 
          class: 'max-w-full h-auto rounded-lg cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all',
        },
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline' },
      }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-3',
      },
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer?.files.length) {
          const file = event.dataTransfer.files[0]
          if (file.type.startsWith('image/')) {
            event.preventDefault()

            // Obtener posición del drop
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })

            // Si hay onImageUpload, subimos y usamos la URL remota
            if (onImageUpload) {
              handleImageUpload(file).then(url => {
                if (url && pos) {
                  const { tr } = view.state
                  const node = view.state.schema.nodes.image.create({ src: url })
                  view.dispatch(tr.insert(pos.pos, node))
                }
              }).catch(() => {})
            } else {
              // Sino, insertamos como DataURL (base64)
              const reader = new FileReader()
              reader.onload = () => {
                const dataUrl = reader.result as string
                if (pos) {
                  const { tr } = view.state
                  const node = view.state.schema.nodes.image.create({ src: dataUrl })
                  view.dispatch(tr.insert(pos.pos, node))
                }
              }
              reader.readAsDataURL(file)
            }
            return true
          }
        }
        return false
      },
      handlePaste: (view, event) => {
        // Check for clipboard items (preferred)
        const items = event.clipboardData?.items
        if (items) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item.type && item.type.startsWith('image/')) {
              event.preventDefault()
              const file = item.getAsFile()
              if (file) {
                // If we have an upload handler, upload and insert remote URL
                if (onImageUpload) {
                  handleImageUpload(file).then(url => {
                    if (url) {
                      editor?.chain().focus().setImage({ src: url }).run()
                    }
                  }).catch(() => {})
                } else {
                  // Otherwise insert as base64 (allowBase64 is enabled)
                  const reader = new FileReader()
                  reader.onload = () => {
                    const dataUrl = reader.result as string
                    editor?.chain().focus().setImage({ src: dataUrl }).run()
                  }
                  reader.readAsDataURL(file)
                }
              }
              return true
            }
          }
        }

        // Fallback: check clipboard.files (some browsers)
        const files = event.clipboardData?.files
        if (files && files.length) {
          for (let i = 0; i < files.length; i++) {
            const file = files[i]
            if (file.type.startsWith('image/')) {
              event.preventDefault()
              if (onImageUpload) {
                handleImageUpload(file).then(url => {
                  if (url) editor?.chain().focus().setImage({ src: url }).run()
                })
              } else {
                const reader = new FileReader()
                reader.onload = () => {
                  const dataUrl = reader.result as string
                  editor?.chain().focus().setImage({ src: dataUrl }).run()
                }
                reader.readAsDataURL(file)
              }
              return true
            }
          }
        }

        // Fallback: HTML content with <img src="data:..."> or <img src="https://...">
        const html = event.clipboardData?.getData('text/html')
        if (html) {
          const match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
          if (match && match[1]) {
            const src = match[1]
            event.preventDefault()
            // If it's a data URL just insert, otherwise insert URL as-is
            editor?.chain().focus().setImage({ src }).run()
            return true
          }
        }

        return false
      },
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  // Función para añadir imagen en la posición actual del cursor
  const addImage = useCallback(async () => {
    if (!onImageUpload) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = false
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const url = await handleImageUpload(file)
        if (url) {
          // Insertar en la posición actual del cursor
          editor?.chain().focus().setImage({ src: url }).run()
        }
      }
    }
    input.click()
  }, [editor, onImageUpload, handleImageUpload])

  // Función para insertar imagen desde URL
  const addImageFromUrl = useCallback(() => {
    const url = window.prompt('URL de la imagen:')
    if (url) {
      editor?.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false)

  useEffect(() => {
    if (!toolbarRef.current) return
    const obs = new IntersectionObserver((entries) => {
      const entry = entries[0]
      // Show floating toolbar when the toolbar is not visible in viewport
      setShowFloatingToolbar(!entry.isIntersecting)
    }, { threshold: 0.1 })

    obs.observe(toolbarRef.current)
    return () => obs.disconnect()
  }, [])

  if (!editor) return null

  return (
    <div className="border rounded-lg overflow-hidden bg-background relative">
      {/* Toolbar inside editor: sticky at top of editor area */}
      <div ref={toolbarRef} className="sticky top-0 z-10 bg-white text-foreground border border-border shadow-sm px-3 py-2">
        <EditorToolbar 
          editor={editor} 
          onImageUpload={onImageUpload ? addImage : undefined}
          onImageFromUrl={addImageFromUrl}
        />
      </div>

      <EditorContent editor={editor} />

      {/* Floating fixed toolbar shown when the toolbar is scrolled out of view */}
      {showFloatingToolbar && editor.isEditable && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-auto">
          <div className="bg-white text-foreground border border-border shadow-lg rounded-md overflow-hidden px-3 py-2">
            <EditorToolbar 
              editor={editor}
              onImageUpload={onImageUpload ? addImage : undefined}
              onImageFromUrl={addImageFromUrl}
            />
          </div>
        </div>
      )}

      {/* Overlay de carga para imágenes */}
      {isUploading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-primary">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Subiendo imagen...</span>
          </div>
        </div>
      )}
    </div>
  )
}
