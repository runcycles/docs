import DefaultTheme from 'vitepress/theme-without-fonts'
import type { Theme } from 'vitepress'
import { useRoute } from 'vitepress'
import { theme, useOpenapi } from 'vitepress-openapi/client'
import { nextTick, onMounted, watch } from 'vue'
import 'vitepress-openapi/dist/style.css'
import './custom.css'
import spec from '../../public/openapi.json'
import Layout from './Layout.vue'
import BlogIndex from './BlogIndex.vue'
import BlogPost from './BlogPost.vue'
import StackDiagram from './StackDiagram.vue'

export default {
  extends: DefaultTheme,
  Layout,
  async enhanceApp({ app }) {
    useOpenapi({ spec })
    theme.enhanceApp({ app })
    app.component('BlogIndex', BlogIndex)
    app.component('BlogPost', BlogPost)
    app.component('StackDiagram', StackDiagram)
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
