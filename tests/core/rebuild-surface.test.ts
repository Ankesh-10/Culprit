import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const projectRoot = new URL('../../', import.meta.url);

function readProjectFile(relativePath: string): string {
  return readFileSync(new URL(relativePath, projectRoot), 'utf8');
}

describe('repository rebuild surface', () => {
  it('pins Node and keeps the required lockfile-driven npm scripts', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as {
      engines?: { node?: string };
      scripts?: Record<string, string>;
    };
    const lockfile = JSON.parse(readProjectFile('package-lock.json')) as { name?: string; lockfileVersion?: number };

    expect(readProjectFile('.nvmrc').trim()).toBe('22.20.0');
    expect(packageJson.engines?.node).toBe('22.x');
    expect(packageJson.scripts).toMatchObject({
      dev: 'vite',
      typecheck: 'tsc --noEmit',
      test: 'vitest run',
      build: 'npm run typecheck && vite build',
      preview: 'vite preview',
    });
    expect(lockfile.name).toBe('culprit');
    expect(lockfile.lockfileVersion).toBeGreaterThanOrEqual(3);
  });

  it('documents a multi-stage Node 22 Docker build and a single local port', () => {
    const dockerfile = readProjectFile('Dockerfile');

    expect(dockerfile).toMatch(/FROM node:22(?:\.\d+\.\d+)?-alpine AS build/);
    expect(dockerfile).toMatch(/FROM node:22(?:\.\d+\.\d+)?-alpine AS runtime/);
    expect(dockerfile).toContain('COPY package.json package-lock.json ./');
    expect(dockerfile).toContain('RUN npm ci');
    expect(dockerfile).toContain('RUN npm run build');
    expect(dockerfile).toContain('COPY --from=build /app/dist ./dist');
    expect(dockerfile).toContain('EXPOSE 4173');
    expect(dockerfile).toContain('HEALTHCHECK');
    expect(dockerfile).toContain('COPY --from=build /app/scripts/serve-dist.mjs ./scripts/serve-dist.mjs');
    expect(dockerfile).toContain('USER node');
    expect(dockerfile).toContain('CMD ["node", "scripts/serve-dist.mjs"]');
    expect(readProjectFile('scripts/serve-dist.mjs')).toContain('4173');
    expect(readProjectFile('scripts/serve-dist.mjs')).toContain('0.0.0.0');
    expect(dockerfile).not.toMatch(/npm install -g|npm i -g/);
  });

  it('keeps the Makefile test sequence authoritative and network-free', () => {
    const makefile = readProjectFile('Makefile');
    const typecheckPosition = makefile.indexOf('npm run typecheck');
    const testPosition = makefile.indexOf('npm test');
    const buildPosition = makefile.indexOf('npm run build');

    expect(typecheckPosition).toBeGreaterThan(-1);
    expect(testPosition).toBeGreaterThan(typecheckPosition);
    expect(buildPosition).toBeGreaterThan(testPosition);
    expect(makefile).not.toMatch(/curl|wget|npm (?:install|ci).*https?:\/\//i);
  });

  it('documents exact setup, development, verification, Docker, and static demo commands', () => {
    const readme = readProjectFile('README.md');

    for (const command of [
      'nvm use',
      'npm ci',
      'npm run dev',
      'make test',
      'npm run build',
      'npm run preview',
      'docker build --tag culprit:phase1 .',
      'docker run --rm --publish 4173:4173 culprit:phase1',
    ]) {
      expect(readme).toContain(command);
    }
    expect(readme).toMatch(/privacy and local boundary/i);
    expect(readme).toMatch(/JSON-lines logs/i);
    expect(readme).toMatch(/Plain-text logs/i);
    expect(readme).toMatch(/culprit-json/);
    expect(readme).toMatch(/hosted-demo input cap/i);
    expect(readme).toMatch(/UTC/);
    expect(readme).toMatch(/byte-identical/);
    expect(readme).toMatch(/ranked suspicion, not probability/i);
    expect(readme).toMatch(/Limitations/);
  });

  it('keeps environment and rebuild instructions secret-free and repository-relative', () => {
    const envExample = readProjectFile('.env.example');
    const contractFiles = ['Dockerfile', '.dockerignore', '.env.example', 'Makefile', 'README.md', 'vite.config.ts', 'src/main.ts', 'src/styles.css', 'scripts/serve-dist.mjs'];
    const contractText = contractFiles.map(readProjectFile).join('\n');
    const repositoryText = contractFiles.filter((path) => path !== 'Dockerfile').map(readProjectFile).join('\n');

    expect(envExample).toMatch(/no secrets/i);
    expect(envExample).toMatch(/no secret is required for the MVP/i);
    expect(repositoryText).not.toMatch(/(?:[A-Za-z]:[\\/]|^|\s)\/(?:Users|home|workspace|app|tmp|var)\b/m);
    expect(readProjectFile('Dockerfile')).not.toMatch(/(?:[A-Za-z]:[\\/]|^|\s)\/(?:Users|home|workspace|tmp|var)\b/m);
    expect(contractText).not.toMatch(/https?:\/\/(?!localhost|127\.0\.0\.1)/i);
    expect(contractText).not.toMatch(/(?:AKIA|BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY|password\s*[:=])/i);
  });

  it('pins LF line endings and commits a Linux CI rebuild with the pinned Node', () => {
    const gitattributes = readProjectFile('.gitattributes');
    const workflow = readProjectFile('.github/workflows/ci.yml');

    expect(gitattributes.split('\n')[0]).toBe('* text=auto eol=lf');
    for (const expected of [
      'node-version-file: .nvmrc',
      'npm ci',
      'make test',
      'node scripts/serve-dist.mjs --smoke',
      'docker build --tag culprit:phase1 .',
      'docker exec culprit node scripts/serve-dist.mjs --smoke',
      'contents: read',
    ]) {
      expect(workflow).toContain(expected);
    }
    expect(workflow).not.toMatch(/secrets\./);
  });

  it('keeps dependency and build noise out of the Docker context', () => {
    expect(readProjectFile('.dockerignore')).toContain('node_modules');
    expect(readProjectFile('.dockerignore')).toContain('dist');
    expect(readProjectFile('.dockerignore')).toContain('.git');
  });
});
