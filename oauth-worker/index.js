// GitHub OAuth proxy for Decap CMS.
// Deploy to Cloudflare Workers. Set two secrets:
//   wrangler secret put GITHUB_CLIENT_ID
//   wrangler secret put GITHUB_CLIENT_SECRET

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/auth') {
      const gh = new URL('https://github.com/login/oauth/authorize');
      gh.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      gh.searchParams.set('redirect_uri', `${url.origin}/callback`);
      gh.searchParams.set('scope', 'repo,user');
      gh.searchParams.set('allow_signup', 'false');
      return Response.redirect(gh.toString(), 302);
    }

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        return new Response('Missing OAuth code', { status: 400 });
      }

      const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const data = await res.json();

      if (data.error || !data.access_token) {
        return new Response(`OAuth error: ${data.error_description || data.error}`, { status: 400 });
      }

      // base64-encode the payload so it embeds safely in the script literal
      const payload = btoa(JSON.stringify({ token: data.access_token, provider: 'github' }));

      const html = `<!doctype html><html><body><script>
(function () {
  var p = JSON.parse(atob('${payload}'));
  function onMessage(e) {
    window.opener.postMessage('authorization:github:success:' + JSON.stringify(p), e.origin);
  }
  window.addEventListener('message', onMessage, false);
  window.opener.postMessage('authorizing:github', '*');
})();
<\/script></body></html>`;

      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return new Response('Not found', { status: 404 });
  },
};
