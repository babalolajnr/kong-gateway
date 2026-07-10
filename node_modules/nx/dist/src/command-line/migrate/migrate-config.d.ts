import type { NxMigrateConfiguration } from '../../config/nx-json';
import { type MigrateArgs } from './command-object';
/**
 * Overlays `nx.json` `migrate` defaults onto the raw `nx migrate` CLI args so a
 * CLI flag always wins, then `nx.json`, then the built-in default. Returns a new
 * args object; the input is not mutated.
 *
 * Phase-aware: generate-only options (`include`, `multiMajorMode`) are applied only
 * when not running migrations; run-only options (`createCommits`,
 * `commitPrefix`, `agentic`, `validate`) only when running migrations. This
 * mirrors where each option is consumed and avoids tripping the "cannot be
 * combined with --run-migrations" guards in `parseMigrationsOptions`.
 *
 * `include` is carried as `includeFromConfig` rather than `include` so it is never
 * mistaken for an explicit `--include`: `resolveInclude` applies it only when the
 * resolved target supports optional updates, leaving targets that don't opt in
 * unaffected.
 */
export declare function applyNxJsonMigrateDefaults(args: MigrateArgs, migrateConfig: NxMigrateConfiguration | undefined, env?: NodeJS.ProcessEnv): MigrateArgs;
/**
 * The single authority for the "a custom commit prefix needs commits enabled"
 * invariant. Run it against the final merged args (after
 * `applyNxJsonMigrateDefaults`): the yargs `.check()` only sees the CLI args,
 * but nx.json may enable commits via `createCommits` or `agentic`. The CLI
 * `.check()` only fast-fails the unrescuable explicit `--no-create-commits`
 * case; everything else is decided here.
 */
export declare function assertCommitPrefixHasCommits(merged: MigrateArgs): void;
