import { AgentId, ResolvedAgentic } from './types';
/** Possible values for `--agentic` after yargs normalization. */
export type AgenticArg = undefined | boolean | AgentId;
export interface ResolveAgenticInput {
    agentic: AgenticArg;
    migrations: ReadonlyArray<{
        prompt?: string;
    }>;
    /** The `--interactive` flag; `false` (`--no-interactive`) disables all prompting. */
    interactive?: boolean;
}
/**
 * Resolves the agentic state for a `--run-migrations` invocation. Runs once,
 * before the migration loop, and its result is cached for every entry.
 */
export declare function resolveAgentic(input: ResolveAgenticInput): Promise<ResolvedAgentic>;
