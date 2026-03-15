---
aside: false
outline: false
title: Admin API Reference
---

<script setup lang="ts">
import { useRoute } from 'vitepress'
import adminSpec from '../../public/admin-openapi.json'

const route = useRoute()
const operationId = route.data.params.operationId
</script>

<OAOperation :operationId="operationId" :spec="adminSpec" />
