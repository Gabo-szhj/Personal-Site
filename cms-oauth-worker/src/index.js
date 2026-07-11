// Minimal OAuth proxy so Decap CMS (admin/config.yml, backend "github") can log in
// with your GitHub account. GitHub's OAuth token exchange requires a client secret,
// which can't live in the browser, so this Worker holds it instead.
//
// Routes:
//   GET /auth      -> redirects the CMS login popup to GitHub's authorize screen
//   GET /callback  -> exchanges the returned code for a token and hands it back
//                     to the admin panel via postMessage

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

function randomState() {
  return crypto.randomUUID();
}

async function handleAuth(request, env) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/callback`;
  const state = randomState();

  const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "repo,user");
  authorizeUrl.searchParams.set("state", state);

  return Response.redirect(authorizeUrl.toString(), 302);
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response("Missing ?code from GitHub", { status: 400 });
  }

  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/callback`,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (tokenData.error || !tokenData.access_token) {
    return new Response(
      `GitHub OAuth error: ${tokenData.error_description || tokenData.error || "no access_token returned"}`,
      { status: 400 }
    );
  }

  const payload = JSON.stringify({ token: tokenData.access_token, provider: "github" });
  const message = `authorization:github:success:${payload}`;
  // Escape any "</script" that could theoretically appear inside the token/payload
  // so it can't prematurely close the inline <script> block below.
  const safeMessageJs = JSON.stringify(message).replace(/<\/script/gi, "<\\/script");

  // Standard Decap/Netlify CMS handshake: wait for the opener to announce its
  // origin, then reply with the token only to that trusted origin.
  const html = `<!DOCTYPE html><html><body>
<script>
(function() {
  function receiveMessage(e) {
    window.opener.postMessage(${safeMessageJs}, e.origin);
    window.removeEventListener('message', receiveMessage, false);
  }
  window.addEventListener('message', receiveMessage, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script>
Authenticated, you can close this window.
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html;charset=UTF-8" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth") {
      return handleAuth(request, env);
    }
    if (url.pathname === "/callback") {
      return handleCallback(request, env);
    }
    return new Response("Decap CMS OAuth proxy is running.\nRoutes: /auth, /callback", {
      headers: { "Content-Type": "text/plain" },
    });
  },
};
