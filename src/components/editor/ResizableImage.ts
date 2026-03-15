import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer, mergeAttributes } from '@tiptap/react'
import { ImageNodeView } from './ImageNodeView'

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 'auto',
        renderHTML: attributes => {
          return {
            width: attributes.width,
          }
        },
        parseHTML: element => element.getAttribute('width') || element.style.width || 'auto',
      },
      height: {
        default: 'auto',
        renderHTML: attributes => {
          return {
            height: attributes.height,
          }
        },
        parseHTML: element => element.getAttribute('height') || element.style.height || 'auto',
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    const { width, height, ...rest } = HTMLAttributes
    
    let style = ''
    if (width && width !== 'auto') style += `width: ${width}; `
    if (height && height !== 'auto') style += `height: ${height}; `
    
    return ['img', mergeAttributes(this.options.HTMLAttributes, rest, { style: style.trim() || undefined })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
})
