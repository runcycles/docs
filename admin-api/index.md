---
aside: false
outline: false
title: Admin API Reference
description: Interactive API reference for the RunCycles Admin API. Manage budgets, tenants, and governance policies.
---

<script setup lang="ts">
import adminSpec from '../public/admin-openapi.json'
</script>

<OASpec :spec="adminSpec" />
