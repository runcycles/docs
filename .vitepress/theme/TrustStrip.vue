<script setup>
</script>

<template>
  <div class="trust-strip">
    <div class="trust-badges">
      <a href="https://pypi.org/project/runcycles/" target="_blank" rel="noopener" aria-label="runcycles on PyPI">
        <img src="https://img.shields.io/pypi/dt/runcycles?label=PyPI&color=555&style=flat-square&logo=pypi&logoColor=white" alt="PyPI downloads" loading="lazy" />
      </a>
      <a href="https://www.npmjs.com/package/runcycles" target="_blank" rel="noopener" aria-label="runcycles on npm">
        <img src="https://img.shields.io/npm/dt/runcycles?label=npm&color=555&style=flat-square&logo=npm&logoColor=white" alt="npm downloads" loading="lazy" />
      </a>
      <a href="https://www.npmjs.com/package/@runcycles/mcp-server" target="_blank" rel="noopener" aria-label="MCP Server on npm">
        <img src="https://img.shields.io/npm/dt/@runcycles/mcp-server?label=MCP%20Server&color=555&style=flat-square&logo=npm&logoColor=white" alt="MCP Server downloads" loading="lazy" />
      </a>
    </div>
  </div>
</template>

<style scoped>
.trust-strip {
  display: flex;
  justify-content: center;
  padding: 10px 24px 0;
}

.trust-badges {
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  gap: 6px;
  overflow: hidden;
}

.trust-badges a {
  display: inline-flex;
  text-decoration: none;
  transition: opacity 0.2s;
}

.trust-badges a:hover {
  opacity: 0.8;
}

.trust-badges img {
  height: 16px;
  opacity: 0.85;
}

@media (max-width: 640px) {
  .trust-strip {
    padding: 8px 16px 0;
  }

  .trust-badges {
    gap: 4px;
  }

  .trust-badges img {
    height: 14px;
  }
}
</style>
