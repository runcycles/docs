import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { useRoute } from 'vitepress'
import { theme, useOpenapi } from 'vitepress-openapi/client'
import { nextTick, onMounted, watch } from 'vue'
import 'vitepress-openapi/dist/style.css'
import spec from '../../public/openapi.json'

export default {
  extends: DefaultTheme,
  async enhanceApp({ app }) {
    useOpenapi({ spec })
    theme.enhanceApp({ app })
  },
  setup() {
    const route = useRoute()
    onMounted(() => {
      watch(
        () => route.path,
        () => {
          if (document.startViewTransition) {
            document.startViewTransition(() => nextTick())
          }
        }
      )
    })
  }
} satisfies Theme
