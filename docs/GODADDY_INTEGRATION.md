# Wiring a GoDaddy site to this backend

GoDaddy's servers can't run Python, FFmpeg or Redis, so the only way a
GoDaddy-hosted page drives this stack is by having the *visitor's browser*
call an external API. That premise is right. Everything below is about the
two ways to act on it, and which one this repo is actually built for.

**Recommendation: use split hosting (option B).** This repo already has a
full Next.js app with Clerk auth, a credit ledger, Stripe billing and a
`/dashboard` — an embedded widget can't reach any of it, for the reason in
the next section.

---

## The blocker for the embedded-widget approach

`/api/v1/videos/generate` requires `X-API-Key`, which
`app/core/auth.py:get_current_user` looks up against `users.api_key`. A
GoDaddy custom-code block is public HTML. Any key pasted into it is
readable by every visitor via View Source, and it is a *per-user* key that
identifies one account.

So an embedded widget has exactly three options:

1. **Ship a real user's key** — publishes a credential that spends that
   user's credits and reads that user's videos. Not viable.
2. **Ship no key** — every request 401s.
3. **Add a separate unauthenticated demo endpoint** — viable, but it is a
   new product surface: no credits, no history, aggressive rate limiting,
   and it needs its own abuse story because it burns GPU time for anonymous
   callers.

Option 3 is a real choice, just not a small one. Nothing in this repo
implements it today.

---

## Option A: embedded widget — what the draft gets wrong

The widget in the draft cannot work against this backend. Five independent
mismatches, each verified against the code:

| Draft | Reality |
|---|---|
| `POST /api/render-video` | No such route. It's `POST /api/v1/videos/generate` (`routers/videos.py:53`). |
| `GET /api/render-video/{id}/status` | It's `GET /api/v1/videos/{id}/status` (`routers/videos.py:105`). |
| Body `{ prompt }` | `VideoGenerateRequest` requires `source_url` (an `HttpUrl`) plus an optional `quality_tier`. A `prompt` body is a 422. |
| No auth header | Both routes depend on `get_current_user`; without `X-API-Key` both 401. |
| Reads `data.progress` and `data.video_url`; treats `"ready"` as done | `VideoStatusResponse` has `video_id`, `status`, `quality_tier`, `output_url`, `render_time_seconds`. There is no `progress` field anywhere in the models, and the worker sets `queued` → `processing` → `completed`/`failed` — never `"ready"`. |

Those last two combine into a silent hang: `progress` is always `undefined`,
so the bar sticks at the `|| 10` fallback; `status` is never `"ready"`, so
the `clearInterval` never runs. The job succeeds and the widget polls
forever with the spinner up. The `catch (pollErr)` only calls
`console.error`, so nothing surfaces to the user either.

Note also that `/api/v1/videos/generate` repurposes an existing video at a
URL. It is not a text-to-video endpoint, so the draft's "enter your concept,
hook, or script outline" textarea has nothing to map onto.

### A corrected widget

This version targets the real routes and fails loudly. It still carries the
API-key problem above — treat it as the shape to use *after* you have
decided how the page authenticates, not as something to paste as-is.

```html
<div id="vv-app" style="max-width:650px;margin:0 auto;background:#141414;padding:24px;border-radius:12px;border:1px solid #262626;color:#fff;font-family:sans-serif">
  <h3 style="margin-top:0;color:#facc15">Repurpose a video</h3>
  <p style="font-size:14px;color:#a1a1aa">Paste the URL of the source video:</p>
  <input id="vv-url" type="url" placeholder="https://..." style="width:100%;box-sizing:border-box;background:#000;border:1px solid #3f3f46;color:#fff;padding:12px;border-radius:8px;margin-bottom:16px">
  <button id="vv-go" style="width:100%;background:linear-gradient(90deg,#facc15,#fb923c);border:none;padding:12px;border-radius:8px;font-weight:bold;cursor:pointer;color:#000">Render</button>
  <p id="vv-msg" role="status" style="font-size:13px;color:#e7e5e4;min-height:1.2em"></p>
  <video id="vv-video" controls style="display:none;width:100%;border-radius:8px;margin-top:12px"></video>
</div>

<script>
(function () {
  var API = "https://api.viralvision.app";
  var KEY = "";              // see "The blocker" above before filling this in
  var POLL_MS = 2000;
  var DEADLINE_MS = 15 * 60 * 1000;

  var url = document.getElementById("vv-url");
  var go = document.getElementById("vv-go");
  var msg = document.getElementById("vv-msg");
  var video = document.getElementById("vv-video");

  function say(text) { msg.textContent = text; }
  function done() { go.disabled = false; go.style.opacity = "1"; }

  go.addEventListener("click", function () {
    var src = url.value.trim();
    if (!src) { say("Enter a video URL first."); return; }

    go.disabled = true;
    go.style.opacity = "0.5";
    video.style.display = "none";
    say("Queueing…");

    fetch(API + "/api/v1/videos/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": KEY },
      body: JSON.stringify({ source_url: src, quality_tier: "standard" })
    })
      .then(function (r) {
        // A 401/422/429 is a normal Response, not a thrown error. Reading
        // the body first means the user sees FastAPI's actual `detail`
        // instead of a generic failure.
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) throw new Error(body.detail || ("Request failed (" + r.status + ")"));
          return body;
        });
      })
      .then(function (job) { poll(job.job_id, Date.now() + DEADLINE_MS); })
      .catch(function (e) { say("Could not start the render: " + e.message); done(); });
  });

  function poll(jobId, deadline) {
    if (Date.now() > deadline) {
      say("Still rendering after 15 minutes — stopping here. Job " + jobId + " is unaffected and may still finish.");
      done();
      return;
    }

    fetch(API + "/api/v1/videos/" + encodeURIComponent(jobId) + "/status", {
      headers: { "X-API-Key": KEY }
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) throw new Error(body.detail || ("Status check failed (" + r.status + ")"));
          return body;
        });
      })
      .then(function (data) {
        if (data.status === "completed") {
          if (!data.output_url) throw new Error("Render finished but returned no output URL.");
          video.src = data.output_url;
          video.style.display = "block";
          say("Done in " + (data.render_time_seconds || "?") + "s.");
          done();
          return;
        }
        if (data.status === "failed") {
          say("Rendering failed. Job id " + jobId + " — quote it in a support request.");
          done();
          return;
        }
        say("Status: " + data.status + "…");
        setTimeout(function () { poll(jobId, deadline); }, POLL_MS);
      })
      .catch(function (e) {
        // Surfaced, not swallowed: a transient blip still retries, but the
        // user can see that it happened rather than watching a dead bar.
        say("Status check problem (" + e.message + ") — retrying…");
        setTimeout(function () { poll(jobId, deadline); }, POLL_MS);
      });
  }
})();
</script>
```

Differences that matter: real routes, `source_url` instead of `prompt`,
`completed`/`failed` instead of `"ready"`, `output_url` instead of
`video_url`, no fabricated progress percentage (the API has no progress to
report, so the widget reports the status string it actually gets), a 15
minute deadline instead of an unbounded `setInterval`, and every failure
path reaching the user.

---

## Option B: split hosting (recommended)

Keep the GoDaddy marketing site at the apex and run the real app on a
subdomain.

1. Deploy the Next.js app in this repo to Vercel (or any host — it builds
   with `output: 'standalone'`).
2. In GoDaddy DNS: `CNAME` record, host `app`, pointing at your host's
   target (`cname.vercel-dns.com` for Vercel).
3. Point every CTA on the GoDaddy page at
   `https://app.viralvision.com/dashboard/upload`.

This is the path the repo is already built for: Clerk gates `/dashboard/*`
through `proxy.ts`, the credit ledger and Stripe webhooks are wired, and no
API key ever reaches a public page — the browser holds a Clerk session
instead, and the Next.js route handlers call the backend server-side.

---

## CORS

`services/api/app/main.py` previously used `allow_origins=["*"]` with a
"tighten before shipping" comment. It is now driven by two env vars:

```
CORS_ALLOWED_ORIGINS=https://viralvision.com,https://app.viralvision.com
CORS_ALLOWED_ORIGIN_REGEX=https://[a-z0-9-]+\.godaddysites\.com
```

**The draft's CORS block does not work.** Starlette compares `allow_origins`
entries as whole strings, so `"https://*.godaddysites.com"` is a literal
asterisk and matches nothing. Measured against `starlette` 0.38.6:

| Origin | `allow_origins=[..., "https://*.godaddysites.com"]` | `allow_origin_regex` |
|---|---|---|
| `https://viralvision.com` | `ACAO: https://viralvision.com` | same |
| `https://myshop.godaddysites.com` | **no header** | `ACAO: https://myshop.godaddysites.com` |
| `https://evil.com` | no header | no header |

The preflight for `https://myshop.godaddysites.com` comes back
**`400 Disallowed CORS origin`** — so the GoDaddy staging preview the draft
was trying to allow is exactly the origin it blocks.

Two other departures from the draft:

- **`allow_credentials=False`.** This API authenticates with `X-API-Key`,
  never cookies, so the browser never needs to send credentials
  cross-origin. Leaving it on is the setting that turns a too-broad origin
  list into a session-stealing primitive.
- **Anchor the regex.** Starlette uses `re.fullmatch`, and the dots are
  escaped, so `https://evil.com/x.godaddysites.com` is refused. An
  unescaped, unanchored pattern would let it through.

With neither variable set the API now refuses all cross-origin browser
requests and logs a warning saying so at startup — the failure otherwise
appears only in the visitor's browser console, with nothing server-side to
explain it.
