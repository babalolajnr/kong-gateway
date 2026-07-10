/**
 * Surfaces a migration's `agentContext` to stdout in an XML-tagged block so an
 * outer AI agent driving `nx migrate` can ingest the hints when no inner agent
 * step ran to consume them.
 *
 * Used only when `agentic.kind === 'inside-agent'`. Under `enabled`, the inner
 * step consumes `agentContext` via the prompt builders. Under `disabled` the
 * run is human-driven and printing agent-targeted context would only add noise.
 *
 * The label format is unambiguous so the outer agent can locate the block
 * within the mixed stdout stream (logger output, migration progress, etc.).
 */
export interface DroppedAgentContextInput {
    migration: {
        package: string;
        name: string;
        prompt?: string;
    };
    agentContext: string[];
}
export declare function formatDroppedAgentContextForOuterAgent(input: DroppedAgentContextInput): string;
export declare function printDroppedAgentContextForOuterAgent(input: DroppedAgentContextInput): void;
