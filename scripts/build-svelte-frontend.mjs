#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildStaticPublish, DEFAULT_STATIC_PUBLISH_DIR } from './build-static-publish.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = path.join(repoRoot, 'svelte-frontend');
const viteCli = path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const stagedPublicDir = path.join(repoRoot, 'dist', 'svelte-public-input');
const CSP_SCRIPT_HASH_PLACEHOLDER = '__PROJECTS_SVELTE_SCRIPT_HASHES__';

function finalizeStaticCsp(outputDir) {
	const hashes = new Set();
	for (const name of readdirSync(outputDir).filter((entry) => entry.endsWith('.html'))) {
		const html = readFileSync(path.join(outputDir, name), 'utf8');
		for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gu)) {
			if (/\bsrc\s*=/u.test(match[1]) || !match[2].trim()) continue;
			hashes.add(`'sha256-${createHash('sha256').update(match[2], 'utf8').digest('base64')}'`);
		}
	}
	if (hashes.size === 0) throw new Error('Static CSP finalization found no inline Svelte bootstrap scripts.');

	const headersPath = path.join(outputDir, '_headers');
	const headers = readFileSync(headersPath, 'utf8');
	if (headers.split(CSP_SCRIPT_HASH_PLACEHOLDER).length !== 2) {
		throw new Error('Static CSP must contain exactly one Svelte script-hash placeholder.');
	}
	writeFileSync(headersPath, headers.replace(CSP_SCRIPT_HASH_PLACEHOLDER, [...hashes].sort().join(' ')), 'utf8');
}

async function buildSvelteFrontend(args) {
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
		finalizeStaticCsp(DEFAULT_STATIC_PUBLISH_DIR);
	} finally {
		rmSync(stagedPublicDir, { recursive: true, force: true });
	}
	process.stdout.write('Built the static WebMCP challenge artifact.\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		await buildSvelteFrontend(process.argv.slice(2));
	} catch (error) {
		process.stderr.write(`${error?.stack || error}\n`);
		process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
	}
}
