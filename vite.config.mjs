import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

function getBuildId() {
  const configured = String(process.env.GITHUB_SHA || process.env.GCQ_BUILD_ID || '').trim();
  if (configured) return `${pkg.version}-${configured.slice(0, 12)}`;
  try {
    const sha = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim();
    if (sha) return `${pkg.version}-${sha}`;
  } catch {
    // Source archives may not contain Git metadata.
  }
  return `${pkg.version}-local`;
}

const buildId = getBuildId();

export default defineConfig({
  base: './',
  publicDir: false,
  define: {
    __GCQ_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    {
      name: 'gcq-build-id',
      transformIndexHtml(html) {
        return html.replaceAll('%GCQ_BUILD_ID%', buildId);
      },
    },
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
    manifest: true,
    cssCodeSplit: true,
  },
});
