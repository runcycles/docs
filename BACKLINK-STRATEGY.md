# SEO Backlink Strategy: Top 10 High-Impact Opportunities

Prioritized by effort-to-impact ratio. Each entry includes the target, why it matters, the specific action, and which existing content to use.

---

## 1. GitHub Awesome Lists

**Impact: Very High | Effort: Low | Timeline: 1-2 weeks**

Submit PRs to get Cycles listed on curated awesome lists. These have high domain authority (DA 90+), thousands of stars, and are where developers discover tools.

**Targets:**
- [awesome-ai-agents](https://github.com/e2b-dev/awesome-ai-agents) (7k+ stars) — list under "Infrastructure / DevOps for Agents"
- [awesome-langchain](https://github.com/kyrolabs/awesome-langchain) (7k+ stars) — list under "Tools" since you have LangChain integration
- [awesome-llmops](https://github.com/tensorchord/awesome-llmops) (4k+ stars) — list under "Cost Management" or "Guardrails"
- [awesome-generative-ai](https://github.com/steven2358/awesome-generative-ai) (5k+ stars) — list under "Developer Tools"

**Action:** Open a PR to each repo. One-line description + link to `https://runcycles.io`. Follow each repo's contribution format exactly. Example:

```markdown
- [Cycles](https://runcycles.io) - Budget authority for autonomous agents. Hard limits on agent spend enforced before execution. Open protocol, Apache 2.0. ([GitHub](https://github.com/runcycles/cycles-protocol))
```

**Why it works:** Every awesome-list link is a permanent, high-DA dofollow backlink. Developers browse these lists when evaluating tools. One merged PR = ongoing referral traffic.

---

## 2. MCP Server Directory

**Impact: Very High | Effort: Low | Timeline: 1 week**

Get the Cycles MCP server listed in the official Model Context Protocol ecosystem.

**Targets:**
- [MCP Servers repository](https://github.com/modelcontextprotocol/servers) — the canonical directory of MCP servers
- [modelcontextprotocol.io](https://modelcontextprotocol.io) — the official MCP site
- [mcp.so](https://mcp.so) — community MCP server directory
- [glama.ai/mcp/servers](https://glama.ai/mcp/servers) — another MCP aggregator

**Action:** Submit a PR to `modelcontextprotocol/servers` adding the Cycles MCP server. Include a clear README explaining what budget authority tools it exposes. For community directories, submit through their listing forms.

**Why it works:** Anyone setting up MCP (Claude Desktop, Cursor, Windsurf users) browses this directory. Extremely targeted audience — these are exactly the people deploying AI agents who need budget controls.

---

## 3. Open Source Integration PRs

**Impact: Very High | Effort: Medium | Timeline: 2-4 weeks**

Submit documentation PRs to the projects Cycles integrates with. Each merged PR = a backlink from a high-DA repo and docs site.

**Targets (prioritized):**
- **LangChain docs** ([python.langchain.com](https://python.langchain.com)) — Add Cycles to their "Integrations" or "Callbacks" section. DA 80+.
- **Vercel AI SDK docs** ([sdk.vercel.ai](https://sdk.vercel.ai)) — Add a "Budget Control" example or integration guide. DA 90+.
- **Spring AI docs** ([spring.io](https://spring.io)) — Add Cycles as a listed integration. DA 90+.

**Action:** For each project, write a concise integration example showing how Cycles works with their tool. Submit as a docs PR. Keep it genuinely useful — not promotional. Link to your integration guides (`/how-to/integrating-cycles-with-langchain`, etc.) for full details.

**Why it works:** These are the highest-DA backlinks you can get. LangChain, Vercel, and Spring docs are where your target users already live. A backlink from `python.langchain.com` pointing to `runcycles.io` is worth more than 50 low-DA links.

---

## 4. Hacker News "Show HN"

**Impact: Very High | Effort: Low | Timeline: 1 day (timing matters)**

A single well-performing Show HN post generates 20-50+ organic backlinks from bloggers, newsletters, and aggregators who pick up HN front-page stories.

**Action:** Post a Show HN with the Cycles Protocol GitHub repo. Title format:

```
Show HN: Cycles – Open protocol for budget authority in AI agent systems (Apache 2.0)
```

Write a top-level comment explaining:
- The problem (runaway agent costs, no pre-execution budget checks)
- What Cycles does differently (reserve-commit lifecycle, three-way decisions)
- That it's open source and self-hostable
- Link to the blog post "The True Cost of Uncontrolled AI Agents" for context

**Timing:** Post Tuesday-Thursday, 8-9am ET. Avoid weekends and Mondays.

**Why it works:** HN front page generates a cascade effect. Tech bloggers, newsletter authors, and aggregator sites all monitor HN. One post can generate dozens of backlinks you didn't directly create. The "open protocol" and "Apache 2.0" angles resonate well on HN.

---

## 5. Dev.to Cross-Publishing

**Impact: High | Effort: Low | Timeline: 1-2 days**

Republish both blog posts on Dev.to with canonical URLs pointing back to `runcycles.io`. Dev.to has DA 90+ and excellent Google indexing.

**Content to republish:**
1. "The True Cost of Uncontrolled AI Agents" → canonical: `https://runcycles.io/blog/true-cost-of-uncontrolled-agents`
2. "AI Agent Budget Patterns: A Practical Guide" → canonical: `https://runcycles.io/blog/agent-budget-patterns-visual-guide`

**Action:** Create a Dev.to organization account for Cycles. Publish both posts with the `canonical_url` front matter set to the original URLs. Tag with: `ai`, `agents`, `devops`, `opensource`.

**Why it works:** Dev.to's `canonical_url` feature means Google attributes SEO value to your original page, not the Dev.to copy. You get the DA 90+ backlink plus exposure to Dev.to's 1M+ monthly developer audience. Zero content creation needed — the posts are already written.

---

## 6. AI Engineering Newsletters

**Impact: High | Effort: Medium | Timeline: 2-4 weeks**

Get featured in 2-3 newsletters that reach AI engineers. A single mention generates direct traffic + backlinks from people who reference the newsletter.

**Targets (pick 2-3):**
- **TLDR AI** (300k+ subscribers) — Submit at [tldr.tech/ai](https://tldr.tech/ai). They feature open-source tools regularly.
- **The Rundown AI** (600k+ subscribers) — Submit via their site. Good for reaching a broader AI audience.
- **Latent Space** (40k+ subscribers, highly targeted) — More technical, more aligned with the "AI infrastructure" positioning. Reach out directly.
- **AI Engineer Newsletter** by swyx — Very targeted at AI engineers building production systems.

**Action:** For TLDR and Rundown, use their submission forms. For Latent Space and AI Engineer, email the editors directly with a concise pitch:

> "We open-sourced Cycles, a protocol for budget authority in AI agent systems. It solves the problem of runaway agent costs by enforcing spend limits before execution — not after. Apache 2.0, self-hostable, with SDKs for Python, TypeScript, and Spring Boot. Here's a blog post that breaks down the cost problem: [link to True Cost post]."

**Why it works:** Newsletter mentions drive a burst of traffic and signal credibility. Newsletter archives become permanent backlinks. Latent Space and AI Engineer readers are exactly your ICP.

---

## 7. Stack Overflow & Reddit Answers

**Impact: High | Effort: Low (ongoing) | Timeline: Ongoing, 30 min/week**

Answer existing questions about AI agent cost control with genuinely helpful answers that naturally reference Cycles.

**Stack Overflow targets** (search for questions with these keywords):
- "limit OpenAI API spending"
- "AI agent cost control"
- "LLM budget limit"
- "prevent runaway API costs"
- "langchain cost tracking"

**Reddit targets:**
- r/MachineLearning, r/LocalLLaMA, r/LangChain, r/artificial — answer posts about agent cost overruns
- Post the "True Cost" blog post to r/MachineLearning as a discussion starter

**Action:** Find 3-5 existing questions/threads per week. Write a genuinely helpful answer that addresses the problem. Mention Cycles naturally where relevant — not as the entire answer, but as one approach. Example:

> "For per-run budget limits with concurrent agents, you need atomic reservation semantics — a simple counter won't handle the race condition. We built Cycles (open source, Apache 2.0) specifically for this: [link]. But if you want a simpler approach, here's how to do it with Redis..."

**Why it works:** SO answers with links generate long-tail traffic for years. Reddit threads get indexed by Google. Helpful answers build credibility and generate clicks from people who are actively searching for what you offer.

---

## 8. The New Stack / InfoQ Guest Post

**Impact: High | Effort: High | Timeline: 3-6 weeks**

Publish one guest post on a high-DA developer publication. Pick one, not both.

**Targets (pick one):**
- **The New Stack** (DA 80+, 2M+ monthly readers) — Covers cloud-native, DevOps, AI infrastructure. Accepts contributed articles.
- **InfoQ** (DA 85+, 1.5M+ monthly readers) — Covers software architecture, AI/ML engineering. Has an editorial review process.

**Content angle:** Adapt the "True Cost of Uncontrolled AI Agents" post into a guest article. Frame it as a general industry problem, not a product pitch. Mention Cycles as "one approach" in the solution section, with a link to the protocol repo.

**Pitch email (for The New Stack):**

> Subject: Contributed article: The hidden costs of autonomous AI agents in production
>
> "As teams deploy autonomous AI agents, uncontrolled spend is becoming a recurring operational incident. I'd like to contribute an article covering the five failure modes we see most often (runaway loops, retry storms, concurrent overspend, scope misconfiguration, and the works-in-dev trap) and the architectural patterns for addressing them. The piece includes concrete cost breakdowns and code examples. ~1,500 words."

**Why it works:** A single backlink from The New Stack or InfoQ is worth 20+ low-DA backlinks. Their articles rank well on Google for years. The "educational, not promotional" framing gets past editorial filters.

---

## 9. Product Hunt Launch

**Impact: High | Effort: Medium | Timeline: 1 day (prep: 1 week)**

Launch Cycles on Product Hunt. Even a modest launch generates 10-20 backlinks from aggregator sites that scrape PH, plus direct traffic.

**Action:**
- Create the PH listing with: tagline "Budget authority for autonomous AI agents", screenshots of the protocol in action, link to GitHub
- Prepare a "maker comment" with the same narrative as the HN post
- Schedule for Tuesday or Wednesday
- Post to your existing channels (Twitter/X, Discord, etc.) on launch day

**Assets to use:**
- Badge SVGs from `/community/badges` for the listing imagery
- Blog post content for the description
- Integration ecosystem page for the "integrations" section of the listing

**Why it works:** PH launches create a cluster of backlinks from sites like AlternativeTo, SaaSHub, SaaSWorthy, and dozens of aggregators that auto-index PH launches. These are permanent, low-effort backlinks. The launch also validates positioning with a real audience.

---

## 10. "Built with Cycles" Badge Seeding

**Impact: Medium-High | Effort: Medium | Timeline: Ongoing**

Get 5-10 open-source projects to add the "Built with Cycles" badge to their READMEs. Each badge is a backlink from a GitHub repo (DA 100).

**Action:**
- Identify 5-10 open-source AI agent projects on GitHub that would benefit from budget controls
- Open issues or PRs offering to help integrate Cycles
- Once integrated, ask them to add the badge (provide the one-line markdown from `/community/badges`)
- Start with projects that already use LangChain, Vercel AI SDK, or MCP — the integration path is already documented

**Targets to seed first:**
- AI agent starter templates / boilerplates on GitHub
- Open-source LangChain agent examples
- MCP server projects that make API calls
- Any project that has filed issues about cost control or rate limiting

**Why it works:** GitHub.com has DA 100. Every README badge linking to `https://runcycles.io` is a high-authority backlink. As adoption grows, this becomes a self-sustaining backlink engine — you don't need to ask for each one.

---

## Priority Order

If you can only do 5 this month, do these first:

| Priority | Action | Time to Complete | Expected Backlinks |
|---|---|---|---|
| 1 | Awesome list PRs (#1) | 2-3 hours | 3-4 high-DA links |
| 2 | MCP directory listing (#2) | 1-2 hours | 2-4 targeted links |
| 3 | Dev.to cross-publish (#5) | 1-2 hours | 2 DA-90 links |
| 4 | Show HN (#4) | 1 hour + timing | 10-50 organic links (if front page) |
| 5 | Stack Overflow answers (#7) | 30 min/week | 3-5 long-tail links/month |

These 5 can be done in a single week and should generate 20-60 backlinks in the first month.

## Content Assets Available

All content referenced in this strategy already exists in the docs:

| Asset | Path | Use For |
|---|---|---|
| True Cost blog post | `/blog/true-cost-of-uncontrolled-agents` | HN, newsletters, guest posts, Dev.to |
| Budget Patterns blog post | `/blog/agent-budget-patterns-visual-guide` | Dev.to, SO answers, newsletter pitches |
| Integration Ecosystem | `/how-to/ecosystem` | Awesome lists, integration PRs |
| Comparison page | `/concepts/how-cycles-compares-...` | SO answers, Reddit threads |
| Built with Cycles badges | `/community/badges` | Badge seeding (#10) |
| Glossary | `/glossary` | Reference in technical answers |
