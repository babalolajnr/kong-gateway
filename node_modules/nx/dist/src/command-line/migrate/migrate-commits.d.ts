/**
 * Discriminated result for `commitMigrationIfRequested`. Distinguishes the
 * shapes the executor needs to react to:
 *
 * - `committed`: a commit landed. `sha` is `null` only when `git rev-parse
 *   HEAD` failed transiently — by contract the diff is no longer in the
 *   working tree.
 * - `no-changes`: commits were requested but there was nothing to commit.
 * - `failed`: the commit attempt itself errored. The diff remains in the
 *   working tree; the executor uses this signal to track pending migrations
 *   so the next successful commit can annotate its body.
 * - `disabled`: commits are off for this run.
 */
export type CommitResult = {
    status: 'committed';
    sha: string | null;
} | {
    status: 'no-changes';
} | {
    status: 'failed';
    reason: string;
} | {
    status: 'disabled';
};
/**
 * Creates a per-migration commit when `shouldCreateCommits` is true.
 *
 * When `pendingMigrations` is non-empty, the commit message body lists
 * those entries so a reader of `git log -p` can see which prior migrations'
 * diffs were absorbed into this commit (because their own commits failed and
 * `git add -A` here captured their working-tree state too). Each entry is
 * rendered as `<package>: <name>` for unambiguous attribution across
 * packages.
 */
export declare function commitMigrationIfRequested(root: string, migration: {
    name: string;
}, shouldCreateCommits: boolean, commitPrefix: string, installDepsIfChanged: () => Promise<void>, pendingMigrations?: ReadonlyArray<{
    package: string;
    name: string;
}>): Promise<CommitResult>;
/**
 * Commits any pre-existing working-tree state into a dedicated "checkpoint"
 * commit before the first migration runs. Without this, the first migration's
 * commit would absorb whatever was already pending — most commonly the
 * package.json edit `nx migrate latest` produces and the lockfile churn from
 * the orchestrator's `npm install --ignore-scripts` step — and migration 1's
 * validation would see that mixed in with the generator output. No-op when
 * the working tree is already clean.
 */
export declare function commitCheckpointBeforeMigrations(root: string, commitPrefix: string): void;
