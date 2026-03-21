<script setup>
</script>

<template>
  <div class="trust-strip">
    <div class="trust-badges">
      <a href="https://pypi.org/project/runcycles/" target="_blank" rel="noopener" aria-label="runcycles on PyPI">
        <img src="https://img.shields.io/pypi/dm/runcycles?label=PyPI&color=00C9A7&style=flat-square" alt="PyPI downloads" loading="lazy" />
      </a>
      <a href="https://www.npmjs.com/package/runcycles" target="_blank" rel="noopener" aria-label="runcycles on npm">
        <img src="https://img.shields.io/npm/dm/runcycles?label=npm&color=00C9A7&style=flat-square" alt="npm downloads" loading="lazy" />
      </a>
      <a href="https://www.npmjs.com/package/@runcycles/mcp-server" target="_blank" rel="noopener" aria-label="MCP Server on npm">
        <img src="https://img.shields.io/npm/dm/@runcycles/mcp-server?label=MCP%20Server&color=00C9A7&style=flat-square" alt="MCP Server downloads" loading="lazy" />
      </a>
      <a href="https://github.com/runcycles/cycles-protocol" target="_blank" rel="noopener" aria-label="Apache 2.0 license">
        <img src="https://img.shields.io/badge/license-Apache%202.0-48484A?style=flat-square" alt="Apache 2.0" loading="lazy" />
      </a>
      <a href="https://github.com/runcycles/cycles-protocol" target="_blank" rel="noopener" aria-label="Open protocol">
        <img src="https://img.shields.io/badge/protocol-open-48484A?style=flat-square" alt="Open Protocol" loading="lazy" />
      </a>
    </div>
  </div>
</template>

<style scoped>
.trust-strip {
  display: flex;
  justify-content: center;
  padding: 16px 24px 0;
}

.trust-badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
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
  height: 20px;
}

@media (max-width: 640px) {
  .trust-strip {
    padding: 12px 16px 0;
  }

  .trust-badges {
    gap: 6px;
  }

  .trust-badges img {
    height: 18px;
  }
}
</style>
