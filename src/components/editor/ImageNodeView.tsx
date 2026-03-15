import { NodeViewWrapper, NodeViewProps } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'

export function ImageNodeView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const [resizing, setResizing] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const [aspectRatio, setAspectRatio] = useState(0)

  useEffect(() => {
    if (imageRef.current) {
      const img = imageRef.current
      if (img.complete) {
        setAspectRatio(img.naturalWidth / img.naturalHeight)
      } else {
        img.onload = () => {
          setAspectRatio(img.naturalWidth / img.naturalHeight)
        }
      }
    }
  }, [])

  const onResizeStart = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    setResizing(true)

    const startX = event.clientX
    const startWidth = imageRef.current?.clientWidth || 0

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentX = moveEvent.clientX
      const diffX = currentX - startX
      const newWidth = Math.max(50, startWidth + diffX)
      
      updateAttributes({
        width: `${newWidth}px`,
        height: aspectRatio ? `${newWidth / aspectRatio}px` : 'auto'
      })
    }

    const onMouseUp = () => {
      setResizing(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [aspectRatio, updateAttributes])

  return (
    <NodeViewWrapper className={`relative inline-block leading-none ${selected ? 'ring-2 ring-primary rounded-lg' : ''}`}>
      <img
        ref={imageRef}
        src={node.attrs.src}
        alt={node.attrs.alt}
        className="max-w-full rounded-lg block"
        style={{
          width: node.attrs.width,
          height: node.attrs.height,
        }}
      />
      
      {editor.isEditable && (
        <div
          className={`absolute bottom-2 right-2 w-5 h-5 bg-primary border-2 border-white rounded-full cursor-nwse-resize shadow-lg flex items-center justify-center transition-opacity hover:scale-110 active:scale-95 z-10 ${
            selected || resizing ? 'opacity-100' : 'opacity-0'
          }`}
          onMouseDown={onResizeStart}
        >
          <div className="w-2 h-2 border-r-2 border-b-2 border-white rotate-45 -translate-x-0.5 -translate-y-0.5" />
        </div>
      )}
    </NodeViewWrapper>
  )
}
