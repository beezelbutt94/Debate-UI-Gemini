// Redirects every request to the primary deployment named by APP_ORIGIN,
// keeping the path and query string. See wrangler.jsonc.
const worker = {
  async fetch(request, env) {
    if (!env.APP_ORIGIN) {
      return new Response("APP_ORIGIN is not configured for this worker.\n", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    // Assign path and query onto the fixed origin rather than resolving the
    // request path against it, so a "//other.host" path can't change the host.
    const { pathname, search } = new URL(request.url);
    const target = new URL(env.APP_ORIGIN);
    target.pathname = pathname;
    target.search = search;
    return Response.redirect(target.toString(), 308);
  },
};

export default worker;
