export declare function isHandoffGitignoreMigration(m: {
    package: string;
    name: string;
}): boolean;
/**
 * Under `--agentic`, the runner writes per-run scratch under
 * `.nx/migrate-runs/<run-id>/`. The v23 migration
 * `23-0-0-add-migrate-runs-to-git-ignore` adds `.nx/migrate-runs` to
 * `.gitignore`; without intervention it would run in its declared slot
 * (typically late), so earlier per-migration commits would absorb the
 * scratch into the user-visible diff.
 *
 * Two paths cover the leak, with no overlap:
 *
 *   1. HOIST — handled by the sort comparator in `executeMigrations`. When
 *      the v23 migration is in the queue, it sorts to position 0 and runs
 *      first via the normal migration runner (with its own log line and
 *      commit). Fully traceable in `git log`.
 *
 *   2. INLINE FALLBACK — this function. When the migration is NOT in the
 *      queue AND the highest target version is < v23 (intra-pre-v23
 *      `--agentic` run), the migration won't run at all. Apply its body
 *      inline against an `FsTree` and commit it as a standalone preflight
 *      commit (or leave in the working tree under `--no-create-commits`).
 *
 * When the migration is not in the queue AND target >= v23, the user is
 * past v23 already. They had the entry historically; if it's gone, that's
 * a conscious removal we respect.
 */
export declare function applyAgenticHandoffGitignoreFallback({ migrations, installedNxVersion, effectiveCreateCommits, commitPrefix, root, }: {
    migrations: ReadonlyArray<{
        package: string;
        name: string;
    }>;
    /**
     * The version of `nx` currently installed in the workspace. After
     * `nx migrate latest` runs (the step before `--run-migrations`), this is
     * the target nx version. We use it as the v23 cutoff instead of walking
     * the migration list: any third-party plugin migration with a `23.x`
     * version is irrelevant to whether `nx` itself crossed v23.
     */
    installedNxVersion: string;
    effectiveCreateCommits: boolean;
    commitPrefix: string;
    root: string;
}): Promise<void>;
