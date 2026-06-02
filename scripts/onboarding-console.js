#!/usr/bin/env node

const { startServer, defaultPort, defaultHost } = require('../tools/onboarding-console/server');

startServer(defaultPort, defaultHost).then(() => {
  console.log(`GCQ onboarding console running at http://${defaultHost}:${defaultPort}`);
  console.log('Open that address in your browser to use the setup quest.');
});
