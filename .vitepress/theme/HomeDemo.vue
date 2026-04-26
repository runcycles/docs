<script setup>
// Cost-dimension demo (the universally visceral one) goes on the homepage.
// The action-authority demo lives on the /demos page alongside this one.
//
// Video sources in order: WebM/VP9 (smaller, modern Chrome/Firefox), then
// MP4/H.264 (broad compatibility). GIF is the last-resort fallback for
// browsers that can't play either format. Poster image renders before
// the video loads and during prefers-reduced-motion (most browsers
// respect that for autoplay video).
const demo = {
  poster: '/demo-runaway-poster.png',
  webm: '/demo-runaway.webm',
  mp4: '/demo-runaway.mp4',
  gifFallback: '/demo-runaway.gif',
  alt: 'Cycles demo: an agent burns ~$10 in 12 seconds without enforcement; with Cycles, the same agent stops cleanly at $1.',
  ctaText: 'Run it locally',
  ctaLink: '/demos/',
}
</script>

<template>
  <section class="home-demo">
    <div class="inner">
      <h2 class="heading">See it in 30 seconds</h2>
      <div class="caption">
        <p class="caption-line">
          <span class="caption-label">Without Cycles:</span>
          ~$10 in 12s — the pace behind $4,200 incidents.
        </p>
        <p class="caption-line">
          <span class="caption-label">With Cycles:</span>
          $1 cap, before the next action ran.
        </p>
      </div>
      <div class="demo-frame">
        <video
          class="demo-video"
          autoplay
          muted
          loop
          playsinline
          :poster="demo.poster"
          preload="metadata"
        >
          <source :src="demo.webm" type="video/webm" />
          <source :src="demo.mp4" type="video/mp4" />
          <img :src="demo.gifFallback" :alt="demo.alt" />
        </video>
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
  margin: 0 0 12px;
  letter-spacing: -0.02em;
  line-height: 1.3;
  border: none;
  padding: 0;
}

@media (min-width: 768px) {
  .heading { font-size: 28px; }
}

.caption {
  margin: 0 0 24px;
}

.caption-line {
  font-size: 15px;
  color: var(--vp-c-text-2);
  line-height: 1.55;
  margin: 0;
}

.caption-line + .caption-line {
  margin-top: 4px;
}

.caption-label {
  font-weight: 700;
  color: var(--vp-c-text-1);
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

.demo-frame video,
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
</style>
