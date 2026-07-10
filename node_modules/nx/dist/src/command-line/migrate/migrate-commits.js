"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commitMigrationIfRequested = commitMigrationIfRequested;
exports.commitCheckpointBeforeMigrations = commitCheckpointBeforeMigrations;
const tslib_1 = require("tslib");
const pc = tslib_1.__importStar(require("picocolors"));
const git_utils_1 = require("../../utils/git-utils");
const logger_1 = require("../../utils/logger");
const output_1 = require("../../utils/output");
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
async function commitMigrationIfRequested(root, migration, shouldCreateCommits, commitPrefix, installDepsIfChanged, pendingMigrations = []) {
    if (!shouldCreateCommits)
        return { status: 'disabled' };
    await installDepsIfChanged();
    // Generator may have only touched gitignored paths, or the prompt half
    // made no change — log neutrally instead of as an error.
    if (!(0, git_utils_1.hasUncommittedChanges)(root)) {
        logger_1.logger.info(pc.dim(`- No changes to commit for ${migration.name}.`));
        return { status: 'no-changes' };
    }
    const commitMessage = buildCommitMessage(`${commitPrefix}${migration.name}`, pendingMigrations);
    try {
        const sha = (0, git_utils_1.tryCommitChanges)(commitMessage, root);
        if (sha)
            return { status: 'committed', sha };
        // null = commit landed but `git rev-parse HEAD` failed (see
        // `tryCommitChanges`). Degraded-but-correct — log yellow, not red.
        logger_1.logger.info(pc.yellow(`The commit for ${migration.name} was created, but its sha could not be resolved (\`git rev-parse HEAD\` failed transiently). Continuing without recording the sha for this step.`));
        return { status: 'committed', sha: null };
    }
    catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        logger_1.logger.info(pc.red(`Could not create a commit for ${migration.name}:\n${reason}\nThe migration's diff remains in the working tree; inspect with \`git status\` / \`git diff\` to review. The next successful commit will absorb it and reference this migration in its body; if no later commit lands, the end-of-run output will list this migration so you can commit or revert manually.`));
        return { status: 'failed', reason };
    }
}
// Migration names come from migrations.json (third-party plugin authored);
// they cannot be trusted to be single-line. Strip CR/LF so a hostile name
// cannot inject body lines or fake `Co-Authored-By:` / similar trailers.
function sanitizeMigrationLine(value) {
    return value.replace(/[\r\n]+/g, ' ').trim();
}
function buildCommitMessage(subject, pendingMigrations) {
    if (pendingMigrations.length === 0)
        return subject;
    // Two newlines separate the subject from the body per the
    // conventional-commits convention.
    const lines = [
        subject,
        '',
        'Includes changes from prior migrations whose own commits failed:',
        ...pendingMigrations.map((p) => `  - ${sanitizeMigrationLine(p.package)}: ${sanitizeMigrationLine(p.name)}`),
    ];
    return lines.join('\n');
}
/**
 * Commits any pre-existing working-tree state into a dedicated "checkpoint"
 * commit before the first migration runs. Without this, the first migration's
 * commit would absorb whatever was already pending — most commonly the
 * package.json edit `nx migrate latest` produces and the lockfile churn from
 * the orchestrator's `npm install --ignore-scripts` step — and migration 1's
 * validation would see that mixed in with the generator output. No-op when
 * the working tree is already clean.
 */
function commitCheckpointBeforeMigrations(root, commitPrefix) {
    if (!(0, git_utils_1.hasUncommittedChanges)(root))
        return;
    try {
        const sha = (0, git_utils_1.tryCommitChanges)(`${commitPrefix}checkpoint before running migrations`, root);
        if (sha) {
            logger_1.logger.info(pc.dim(`- Checkpoint commit created: ${sha}`));
            return;
        }
        // null = commit landed but `git rev-parse HEAD` failed (see
        // `tryCommitChanges`). State is captured, just unanchored.
        output_1.output.warn({
            title: 'Could not resolve checkpoint commit sha',
            bodyLines: [
                'The checkpoint commit was created, but its sha could not be resolved (`git rev-parse HEAD` failed transiently).',
            ],
        });
    }
    catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        output_1.output.warn({
            title: 'Could not create checkpoint commit before migrations',
            bodyLines: [
                reason,
                `Migration 1's commit will absorb any pre-existing working-tree state.`,
            ],
        });
    }
}
