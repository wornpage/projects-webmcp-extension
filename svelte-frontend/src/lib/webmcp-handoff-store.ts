import { writable } from 'svelte/store';
import {
	emptyWebMcpHandoffSession,
	recordWebMcpHandoffStepState
} from './webmcp-handoff-session.mjs';

export type WebMcpHandoffStepId =
	| 'work-scope'
	| 'review-scope'
	| 'next-proposal'
	| 'draft-batch'
	| 'human-decision';

export type WebMcpHandoffStep = {
	id: WebMcpHandoffStepId;
	title: string;
	summary: string;
	evidence: string;
	authority: string;
};

export type WebMcpHandoffSession = {
	steps: WebMcpHandoffStep[];
	agentSaved: 0;
	agentStarted: 0;
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
