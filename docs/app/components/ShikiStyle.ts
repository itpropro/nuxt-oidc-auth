import { defineComponent, h } from 'vue'

export default defineComponent({
  name: 'ShikiStyle',
  setup(_, { slots }) {
    return () => {
      const css = slots.default?.()
        .map(node => typeof node.children === 'string' ? node.children : '')
        .join('') || ''

      return h('style', {
        'data-allow-mismatch': 'text',
        'textContent': css,
      })
    }
  },
})
