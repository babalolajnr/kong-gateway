import type { MigrateInclude } from './command-object';
export type MigrateIncludeSource = 'flag' | 'nx-json' | 'prompt' | 'default';
export type MigrateMultiMajorChoice = 'gradual' | 'direct';
export type MigrateFetchFallbackReason = 'env-skip' | 'unsupported-registry' | 'provenance' | 'registry-error';
export type MigrateFetchStats = {
    registryCount: number;
    installCount: number;
    fallbackReason?: MigrateFetchFallbackReason;
};
export type MigrateAgenticOutcome = 'enabled' | 'disabled' | 'inside-agent';
export type MigratePromptChoices = {
    include: MigrateInclude;
    multi_major: 'direct' | 'latest-in-current' | 'latest-in-next';
    agentic: 'yes-once' | 'yes-flex' | 'yes-pin' | 'no-once' | 'no-never';
    agent_select: string;
    ambiguous_agent_outcome: 'abort' | 'continue';
};
export type MigratePromptName = keyof MigratePromptChoices;
export type MigrateGenerateErrorCode = 'resolve_version' | 'fetch_migrations' | 'package_updates';
export type MigrateRunErrorCode = 'npm_install' | 'migration_exec' | 'agentic' | 'other';
export declare function setMigrateInclude(include: MigrateInclude): void;
export declare function setMigrateIncludeSource(source: MigrateIncludeSource): void;
export declare function classifyMigrateFetchFallback(error: unknown): MigrateFetchFallbackReason;
/**
 * Records an interactive migrate prompt and the user's selection.
 *
 * The prompt identity is encoded in the event name (`migrate_prompt_<prompt>`)
 * so it doesn't cost a GA custom dimension; `choice` is one dimension
 * multiplexed across all prompts, read conditioned on the event name. The
 * per-prompt value-spaces are typed in {@link MigratePromptChoices}.
 */
export declare function reportMigratePrompt<P extends MigratePromptName>(prompt: P, choice: MigratePromptChoices[P]): void;
export declare function reportMigrateGenerateStart(opts: {
    targetPackage: string;
    interactive?: boolean;
    excludeAppliedMigrations?: boolean;
}): void;
export declare function reportMigrateGenerateComplete(opts: {
    targetVersion: string;
    requestedTargetVersion: string;
    installedTargetVersion: string | null | undefined;
    include: MigrateInclude;
    multiMajorChoice?: MigrateMultiMajorChoice;
    fetchStats?: MigrateFetchStats;
}): void;
export declare function reportMigrateGenerateError(code: MigrateGenerateErrorCode, error: unknown): void;
export declare function reportMigrateRunStart(opts: {
    createCommits: boolean;
    migrationCount: number;
}): void;
/**
 * Whether the current process recorded a `migrate_run_start` event. Lets
 * shared code paths (e.g. `executeMigrations`, reused by `nx repair`) skip
 * migrate events when not running inside a migrate run.
 */
export declare function hasMigrateRunStarted(): boolean;
export declare function reportMigrateRunComplete(opts: {
    agenticOutcome: MigrateAgenticOutcome;
    agentUsed?: string;
    migrationCount: number;
    appliedCount: number;
}): void;
export declare function reportMigrateRunError(opts: {
    code: MigrateRunErrorCode;
    migrationPackage?: string;
    migrationName?: string;
    migrationCount?: number;
    error?: unknown;
}): void;
export declare function computeMajorsCrossed(installed: string | null | undefined, target: string | null | undefined): number | undefined;
export declare function safeReport(emit: () => void): void;
