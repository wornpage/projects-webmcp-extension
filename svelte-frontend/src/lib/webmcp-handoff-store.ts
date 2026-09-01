import { writable } from 'svelte/store';
import {
	emptyWebMcpHandoffSession,
	recordWebMcpHandoffStepState
} from './webmcp-handoff-session.mjs';

type WebMcpHandoffStepId =
	| 'work-scope'
	| 'review-scope'
	| 'next-proposal'
	| 'draft-batch'
	| 'human-decision';

type WebMcpHandoffStep = {
	id: WebMcpHandoffStepId;
	title: string;
	summary: string;
};

type WebMcpHandoffSession = {
	steps: WebMcpHandoffStep[];
};

export const webMcpHandoffSession = writable<WebMcpHandoffSession>(
	emptyWebMcpHandoffSession() as WebMcpHandoffSession
);

export function recordWebMcpHandoffStep(step: WebMcpHandoffStep) {
	webMcpHandoffSession.update((session) =>
		recordWebMcpHandoffStepState(session, step) as WebMcpHandoffSession
	);
}

export function resetWebMcpHandoffSession() {
	webMcpHandoffSession.set(emptyWebMcpHandoffSession() as WebMcpHandoffSession);
}
