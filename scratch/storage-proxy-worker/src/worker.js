export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-firebase-token',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const incomingUrl = new URL(request.url);
    if (incomingUrl.pathname !== '/storage-proxy') {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const target = incomingUrl.searchParams.get('url') || '';
    if (!target) {
      return new Response(JSON.stringify({ error: 'Missing url query param' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsedTarget;
    try {
      parsedTarget = new URL(target);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid target URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isFirebaseStorageHost = parsedTarget.hostname === 'firebasestorage.googleapis.com';
    if (!isFirebaseStorageHost) {
      return new Response(JSON.stringify({ error: 'Only firebasestorage.googleapis.com URLs are allowed' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firebaseToken = request.headers.get('x-firebase-token') || '';

    let upstream;
    try {
      const requestInit = {
        method: 'GET',
        redirect: 'follow',
        cf: { cacheEverything: true, cacheTtl: 3600 },
        headers: {},
      };

      if (firebaseToken) {
        requestInit.headers.Authorization = `Firebase ${firebaseToken}`;
      }

      upstream = await fetch(parsedTarget.toString(), requestInit);

      // Some endpoints accept Bearer rather than Firebase prefix.
      if (!upstream.ok && upstream.status === 403 && firebaseToken) {
        requestInit.headers.Authorization = `Bearer ${firebaseToken}`;
        upstream = await fetch(parsedTarget.toString(), requestInit);
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch upstream image', details: String(error) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: 'Upstream returned non-OK', status: upstream.status }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const passthroughHeaders = new Headers(corsHeaders);
    passthroughHeaders.set('Content-Type', upstream.headers.get('Content-Type') || 'application/octet-stream');
    passthroughHeaders.set('Cache-Control', upstream.headers.get('Cache-Control') || 'public, max-age=3600');

    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: passthroughHeaders,
    });
  },
};
