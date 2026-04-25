<script setup>
// Cost-dimension demo (the universally visceral one) goes on the homepage.
// The action-authority demo lives on the /demos page alongside this one.
const demo = {
  src: '/demo-runaway.gif',
  alt: 'Cycles demo: an agent burns $6 in 30 seconds without enforcement; with Cycles, the same agent stops cleanly at $1.',
  caption: '$6 runaway → $1 cap. docker compose up, no API keys required.',
  ctaText: 'Run it locally',
  ctaLink: '/demos/',
}
</script>

<template>
  <section class="home-demo">
    <div class="inner">
      <h2 class="heading">See it in 30 seconds</h2>
      <p class="caption">{{ demo.caption }}</p>
      <div class="demo-frame">
        <img
          :src="demo.src"
          :alt="demo.alt"
          loading="eager"
          decoding="async"
        />
      </div>
      <a :href="demo.ctaLink" class="demo-cta">{{ demo.ctaText }} &rarr;</a>
    </div>
  </section>
</template>

<style scoped>
.home-demo {
  padding: 0 24px 48px;
}

@media (min-width: 640px) {
  .home-demo { padding: 0 48px 48px; }
}

@media (min-width: 960px) {
  .home-demo { padding: 0 64px 48px; }
}

.inner {
  max-width: 1024px;
  margin: 0 auto;
  text-align: center;
}

.heading {
  font-size: 24px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin: 0 0 8px;
  letter-spacing: -0.02em;
  line-height: 1.3;
  border: none;
  padding: 0;
}

@media (min-width: 768px) {
  .heading { font-size: 28px; }
}

.caption {
  font-size: 15px;
  color: var(--vp-c-text-2);
  margin: 0 0 24px;
  line-height: 1.55;
}

.demo-frame {
  margin: 0 auto 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
  max-width: 880px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.demo-frame img {
  display: block;
  width: 100%;
  height: auto;
}

.demo-cta {
  display: inline-block;
  padding: 10px 22px;
  border-radius: 20px;
  background: var(--vp-c-brand-1);
  color: var(--vp-c-bg);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  letter-spacing: -0.01em;
  transition: background 0.2s, transform 0.1s;
}

.demo-cta:hover {
  background: var(--vp-c-brand-2);
}

.demo-cta:active {
  transform: translateY(1px);
}

/* Reduced-motion fallback: hide the autoplay GIF and show a static
   prompt instead. Users with prefers-reduced-motion see a click-to-view
   path rather than autoplay animation. */
@media (prefers-reduced-motion: reduce) {
  .demo-frame {
    position: relative;
  }
  .demo-frame::after {
    content: 'Animation paused for reduced-motion preference. View the full demo →';
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-2);
    font-size: 15px;
    font-weight: 500;
    text-align: center;
  }
  .demo-frame img {
    visibility: hidden;
  }
}
</style>
