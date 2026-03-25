import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { useRoute } from 'vitepress'
import { theme, useOpenapi } from 'vitepress-openapi/client'
import { nextTick, onMounted, watch } from 'vue'
import 'vitepress-openapi/dist/style.css'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './custom.css'
import spec from '../../public/openapi.json'
import Layout from './Layout.vue'
import BlogIndex from './BlogIndex.vue'
import BlogPost from './BlogPost.vue'

export default {
  extends: DefaultTheme,
  Layout,
  async enhanceApp({ app }) {
    useOpenapi({ spec })
    theme.enhanceApp({ app })
    app.component('BlogIndex', BlogIndex)
    app.component('BlogPost', BlogPost)
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
