const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  getBootstrapData,
  parseServiceAccount,
  validateSetupInput,
  runAutomaticSetup,
  recheckExistingSchool,
} = require('./lib');

const publicDir = path.join(__dirname, 'public');
const defaultPort = Number(process.env.ONBOARDING_CONSOLE_PORT || process.env.PORT || 3020);
const defaultHost = process.env.ONBOARDING_CONSOLE_HOST || '127.0.0.1';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendText(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    const err = new Error('The request body was not valid JSON.');
    err.statusCode = 400;
    throw err;
  }
}

function sanitizeStaticPath(requestPath) {
  const target = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const resolved = path.normalize(target).replace(/^(\.\.[/\\])+/, '');
  return path.join(publicDir, resolved);
}

async function serveStatic(req, res, pathname) {
  const filePath = sanitizeStaticPath(pathname);
  if (!filePath.startsWith(publicDir)) {
    sendText(res, 403, 'Forbidden');
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 404, 'Not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const body = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function handleValidateServiceAccount(req, res) {
  const body = await readJsonBody(req);
  const serviceAccount = parseServiceAccount(body.serviceAccount);
  const typedProjectId = String(body.projectId || '').trim();
  const matchesProject = !typedProjectId || typedProjectId === serviceAccount.project_id;

  sendJson(res, 200, {
    ok: matchesProject,
    summary: {
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      looksValid: true,
      matchesProject,
    },
    message: matchesProject
      ? 'The Firebase service account looks valid for this school.'
      : 'The Firebase key belongs to a different project than the one typed above.',
  });
}

async function handleValidateSetup(req, res) {
  const body = await readJsonBody(req);
  const result = validateSetupInput(body);
  sendJson(res, 200, result);
}

async function handleRunSetup(req, res) {
  const body = await readJsonBody(req);
  const result = await runAutomaticSetup(body);
  sendJson(res, 200, result);
}

async function handleRecheck(req, res) {
  const body = await readJsonBody(req);
  const projectId = String(body.projectId || '').trim();
  if (!projectId) {
    sendJson(res, 400, {
      ok: false,
      error: 'Please choose a saved school before running the check.',
    });
    return;
  }
  const result = await recheckExistingSchool(projectId);
  sendJson(res, 200, result);
}

function createServer() {
  return http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const { pathname } = requestUrl;

    try {
      if (req.method === 'GET' && pathname === '/api/bootstrap') {
        sendJson(res, 200, getBootstrapData());
        return;
      }
      if (req.method === 'POST' && pathname === '/api/validate-service-account') {
        await handleValidateServiceAccount(req, res);
        return;
      }
      if (req.method === 'POST' && pathname === '/api/validate-setup') {
        await handleValidateSetup(req, res);
        return;
      }
      if (req.method === 'POST' && pathname === '/api/run-setup') {
        await handleRunSetup(req, res);
        return;
      }
      if (req.method === 'POST' && pathname === '/api/recheck') {
        await handleRecheck(req, res);
        return;
      }
      if (req.method === 'GET') {
        await serveStatic(req, res, pathname);
        return;
      }

      sendJson(res, 404, { ok: false, error: 'Not found' });
    } catch (error) {
      const statusCode = error.statusCode || error.status || 500;
      sendJson(res, statusCode, {
        ok: false,
        error: error.message || 'Something went wrong.',
        details: error.validationErrors || '',
      });
    }
  });
}

function startServer(port = defaultPort, host = defaultHost) {
  const server = createServer();
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      resolve(server);
    });
  });
}

module.exports = {
  createServer,
  startServer,
  defaultPort,
  defaultHost,
};

if (require.main === module) {
  startServer(defaultPort, defaultHost).then(() => {
    console.log(`GCQ onboarding console running at http://${defaultHost}:${defaultPort}`);
    console.log('Open that address in your browser to set up or re-check a school.');
  });
}
