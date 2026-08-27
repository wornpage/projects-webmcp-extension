#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(repoRoot, 'dist');
export const DEFAULT_STATIC_PUBLISH_DIR = path.join(distRoot, 'static-publish');

export const STATIC_PUBLISH_FILES = Object.freeze([
	'index.html',
	'landing.html',
	'THIRD_PARTY_LICENSES.txt',
	'manifest.json',
	'assets/demo.css',
	'assets/landing.css',
	'assets/landing.js',
	'assets/favicon.png',
	'assets/favicon.svg',
	'assets/og-image.svg',
	'data/demo-packs.json'
]);

export const SVELTE_PUBLIC_FILES = Object.freeze([
	'_headers',
	'robots.txt'
]);

const STATIC_404_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Not found — WebMCP Challenge</title>
<style>
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f5f3ef; color: #21322b; font: 15px/1.5 system-ui, sans-serif; }
main { max-width: 420px; padding: 32px 20px; text-align: center; }
h1 { font-size: 20px; margin: 0 0 8px; }
p { margin: 0 0 20px; color: #5b6b63; }
a { color: #0d716a; font-weight: 700; }
</style>
</head>
<body><main><h1>This route is not in the challenge build</h1><p>The public edition contains only the judge guide, Work, Review, and Next screens.</p><p><a href="/webmcp-challenge">Open the guide</a></p></main></body>
</html>
`;

if (isMainModule()) {
	const outputDir = path.resolve(process.argv[2] || DEFAULT_STATIC_PUBLISH_DIR);
	await buildStaticPublish(outputDir);
	console.log(`Built static input: ${path.relative(repoRoot, outputDir)}`);
}

export async function buildStaticPublish(outputDir) {
	const resolvedOutputDir = path.resolve(outputDir);
	assertSafeOutputDir(resolvedOutputDir);
	await fs.rm(resolvedOutputDir, { recursive: true, force: true });

	for (const relativeFile of STATIC_PUBLISH_FILES) {
		const source = path.join(repoRoot, relativeFile);
		const target = path.join(resolvedOutputDir, relativeFile);
		await fs.mkdir(path.dirname(target), { recursive: true });
		await fs.copyFile(source, target);
	}

	for (const relativeFile of SVELTE_PUBLIC_FILES) {
		const source = path.join(repoRoot, 'svelte-frontend', 'static', relativeFile);
		const target = path.join(resolvedOutputDir, relativeFile);
		await fs.copyFile(source, target);
	}

	await fs.writeFile(path.join(resolvedOutputDir, '404.html'), STATIC_404_PAGE, 'utf8');
}

function assertSafeOutputDir(outputDir) {
	const relativeToDist = path.relative(distRoot, outputDir);
	if (!relativeToDist || relativeToDist.startsWith('..') || path.isAbsolute(relativeToDist)) {
		throw new Error('Static output must be a child of dist/.');
	}
}

function isMainModule() {
	return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}
