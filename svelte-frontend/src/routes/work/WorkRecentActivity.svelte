<script lang="ts">
	import {
		activityActor,
		activityEvidenceText,
		recentPackActivity,
		relativeActivityTime
	} from '$lib/activity';
	import { WornAccordion, WornTimeline } from '$lib/components';
	import type { DemoPack } from '$lib/demo-workflow';

	let { packs }: { packs: DemoPack[] } = $props();

	const RECENT_ACTIVITY_LIMIT = 6;
	let recentActivity = $derived(
		recentPackActivity(packs, Math.max(RECENT_ACTIVITY_LIMIT, packs.length)).slice(0, RECENT_ACTIVITY_LIMIT)
	);
	let timelineEntries = $derived(recentActivity.map((entry) => ({
		date: entry.at,
		description: activityEvidenceText(entry),
		href: `/next?pack=${encodeURIComponent(entry.packId)}`,
		meta: activityActor(entry) || undefined,
		title: entry.packTitle
	})));
</script>

{#if recentActivity.length > 0}
	<div class="demo-work-recent">
		<WornAccordion label="Recent activity">
			<WornTimeline
				class="demo-work-recent-timeline"
				entries={timelineEntries}
				ariaLabel="Recent work activity"
				density="compact"
				headingLevel={2}
				formatDate={relativeActivityTime}
			/>
		</WornAccordion>
	</div>
{/if}

<style>
	.demo-work-recent{margin-top:16px}
	:global(.demo-work-recent-timeline){--worn-timeline-max-inline-size:100%;margin-top:6px}
</style>
