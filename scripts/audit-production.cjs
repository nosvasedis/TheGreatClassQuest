#!/usr/bin/env node

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error('audit: npm_execpath is unavailable');
  process.exit(1);
}
const targets = [
  { label: 'workspace and development tools', cwd: root, omitDev: false },
  { label: 'Firebase Functions production', cwd: path.join(root, 'functions'), omitDev: true },
  { label: 'billing production', cwd: path.join(root, 'billing'), omitDev: true },
];

let blocked = false;

for (const target of targets) {
  const args = ['audit', '--json'];
  if (target.omitDev) args.push('--omit=dev');
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd: target.cwd,
    encoding: 'utf8',
    windowsHide: true,
  });
  let report;
  try {
    report = JSON.parse(result.stdout || '{}');
  } catch {
    console.error(`audit: could not parse npm audit output for ${target.label}`);
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(1);
  }
  if (!report.metadata?.vulnerabilities) {
    console.error(`audit: npm returned no vulnerability metadata for ${target.label}`);
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(1);
  }
  const counts = report.metadata?.vulnerabilities || {};
  const summary = ['critical', 'high', 'moderate', 'low']
    .map((severity) => `${severity}=${Number(counts[severity] || 0)}`)
    .join(' ');
  console.log(`audit: ${target.label}: ${summary}`);
  if (Number(counts.critical || 0) > 0 || Number(counts.high || 0) > 0) blocked = true;
}

if (blocked) {
  console.error('audit: release blocked by high or critical vulnerabilities');
  process.exit(1);
}

console.log('audit: release gate passed (zero high or critical vulnerabilities)');
