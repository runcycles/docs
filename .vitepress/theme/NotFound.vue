<script setup>
</script>

<template>
  <div class="not-found">
    <p class="code">404</p>
    <h1 class="title">Page Not Found</h1>
    <p class="description">The page you're looking for doesn't exist or has been moved.</p>

    <div class="links">
      <h2>Where to go</h2>
      <ul>
        <li><a href="/quickstart/what-is-cycles">What is Cycles?</a> — start with the basics</li>
        <li><a href="/quickstart/end-to-end-tutorial">End-to-End Tutorial</a> — build a budget-guarded app in 10 minutes</li>
        <li><a href="/api/">API Reference</a> — interactive endpoint documentation</li>
        <li><a href="/how-to/adding-cycles-to-an-existing-application">How-To Guides</a> — integration patterns and recipes</li>
      </ul>
    </div>

    <div class="action">
      <a class="link" href="/" aria-label="Go to home">
        Take me home
      </a>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  padding: 64px 24px 96px;
  text-align: center;
}

.code {
  font-size: 64px;
  font-weight: 700;
  line-height: 1;
  color: var(--vp-c-brand-1);
}

.title {
  padding-top: 12px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 28px;
}

.description {
  padding-top: 12px;
  font-size: 14px;
  color: var(--vp-c-text-2);
  line-height: 24px;
}

.links {
  padding-top: 24px;
  text-align: left;
  max-width: 480px;
  margin: 0 auto;
}

.links h2 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.links ul {
  list-style: none;
  padding: 0;
}

.links li {
  padding: 6px 0;
  font-size: 14px;
  line-height: 22px;
  color: var(--vp-c-text-2);
}

.links a {
  color: var(--vp-c-brand-1);
  font-weight: 500;
  text-decoration: none;
}

.links a:hover {
  text-decoration: underline;
}

.action {
  padding-top: 28px;
}

.link {
  display: inline-block;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 16px;
  padding: 3px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
  text-decoration: none;
  transition: border-color 0.25s, color 0.25s;
}

.link:hover {
  color: var(--vp-c-brand-2);
  border-color: var(--vp-c-brand-2);
}
</style>
