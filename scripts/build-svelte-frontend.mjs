#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildStaticPublish, DEFAULT_STATIC_PUBLISH_DIR } from './build-static-publish.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = path.join(repoRoot, 'svelte-frontend');
const viteCli = path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const stagedPublicDir = path.join(repoRoot, 'dist', 'svelte-public-input');

export async function buildSvelteFrontend(args = process.argv.slice(2)) {
	try {
		await buildStaticPublish(stagedPublicDir);
		rmSync(DEFAULT_STATIC_PUBLISH_DIR, { recursive: true, force: true });
		const result = spawnSync(process.execPath, [viteCli, 'build', ...args], {
			cwd: frontendRoot,
			env: { ...process.env, PROJECTS_SVELTE_ASSET_DIR: stagedPublicDir },
			stdio: 'inherit',
			windowsHide: true
		});
		if (result.error) throw result.error;
		if (result.status !== 0) {
			const error = new Error(`Static Svelte build exited with status ${result.status ?? 1}.`);
			error.exitCode = result.status ?? 1;
			throw error;
		}
	} finally {
		rmSync(stagedPublicDir, { recursive: true, force: true });
	}
	process.stdout.write('Built the static WebMCP challenge artifact.\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		await buildSvelteFrontend();
	} catch (error) {
		process.stderr.write(`${error?.stack || error}\n`);
		process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
	}
}
