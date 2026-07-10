"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_DEFINITIONS = exports.opencodeDefinition = exports.codexDefinition = exports.claudeCodeDefinition = void 0;
exports.getAgentDefinition = getAgentDefinition;
const os_1 = require("os");
const path_1 = require("path");
const handoff_1 = require("./handoff");
// --- Claude Code ---------------------------------------------------------
function claudeCodeWellKnownPaths() {
    if (process.platform === 'win32') {
        const home = process.env.USERPROFILE;
        return home ? [(0, path_1.join)(home, '.local', 'bin', 'claude.exe')] : [];
    }
    return [(0, path_1.join)((0, os_1.homedir)(), '.claude', 'local', 'claude')];
}
// Pre-authorizes the handoff write: Claude Code's default permission mode
// asks before file writes it has no allow rule for, so without this each step
// ends with an approval prompt for nx's own handoff scratch. Prefix-less
// patterns resolve against the session cwd (pinned to the workspace root
// below); `Edit` covers corrections to an already-written handoff.
const CLAUDE_CODE_HANDOFF_ALLOWED_TOOLS = `Write(${handoff_1.MIGRATE_RUNS_RELATIVE_DIR}/**),Edit(${handoff_1.MIGRATE_RUNS_RELATIVE_DIR}/**)`;
function claudeCodeBuildInteractive(ctx) {
    return {
        // `--allowedTools` is variadic (space/comma separated): a positional
        // placed right after its value gets swallowed as another rule. The rules
        // must stay in one comma-joined element with a non-variadic flag
        // (`--system-prompt`) between them and the user prompt.
        args: [
            '--allowedTools',
            CLAUDE_CODE_HANDOFF_ALLOWED_TOOLS,
            '--system-prompt',
            ctx.systemContext,
            ctx.userPrompt,
        ],
        cwd: ctx.workspaceRoot,
    };
}
exports.claudeCodeDefinition = {
    id: 'claude-code',
    displayName: 'Claude Code',
    binaryNames: ['claude'],
    wellKnownPaths: claudeCodeWellKnownPaths,
    buildInteractive: claudeCodeBuildInteractive,
};
// --- OpenAI Codex --------------------------------------------------------
function codexWellKnownPaths() {
    return [];
}
// No handoff permission flag: codex's default sandbox already allows writes
// inside the cwd tree without prompting, and a user-hardened read-only config
// is a deliberate choice we don't override.
function codexBuildInteractive(ctx) {
    return {
        args: ['-c', `developer_instructions=${ctx.systemContext}`, ctx.userPrompt],
        cwd: ctx.workspaceRoot,
    };
}
exports.codexDefinition = {
    id: 'codex',
    displayName: 'OpenAI Codex',
    binaryNames: ['codex'],
    wellKnownPaths: codexWellKnownPaths,
    buildInteractive: codexBuildInteractive,
};
// --- OpenCode ------------------------------------------------------------
const OPENCODE_TRANSIENT_AGENT_NAME = 'nx-migrate';
function opencodeWellKnownPaths() {
    if (process.platform === 'win32') {
        return [];
    }
    const candidates = [];
    const home = (0, os_1.homedir)();
    const installDir = process.env.OPENCODE_INSTALL_DIR;
    const xdgBinDir = process.env.XDG_BIN_DIR;
    if (installDir) {
        candidates.push((0, path_1.join)(installDir, 'opencode'));
    }
    if (xdgBinDir) {
        candidates.push((0, path_1.join)(xdgBinDir, 'opencode'));
    }
    candidates.push((0, path_1.join)(home, 'bin', 'opencode'));
    candidates.push((0, path_1.join)(home, '.opencode', 'bin', 'opencode'));
    return candidates;
}
// No handoff permission config: opencode's `edit` permission defaults to
// allow, and injecting one would clobber (not merge with) a user's own
// permission patterns.
function opencodeBuildInteractive(ctx) {
    const config = {
        agent: {
            [OPENCODE_TRANSIENT_AGENT_NAME]: { prompt: ctx.systemContext },
        },
    };
    return {
        args: [
            '--agent',
            OPENCODE_TRANSIENT_AGENT_NAME,
            '--prompt',
            ctx.userPrompt,
        ],
        env: { OPENCODE_CONFIG_CONTENT: JSON.stringify(config) },
        cwd: ctx.workspaceRoot,
    };
}
exports.opencodeDefinition = {
    id: 'opencode',
    displayName: 'OpenCode',
    binaryNames: ['opencode'],
    wellKnownPaths: opencodeWellKnownPaths,
    buildInteractive: opencodeBuildInteractive,
};
// --- Registry ------------------------------------------------------------
exports.AGENT_DEFINITIONS = [
    exports.claudeCodeDefinition,
    exports.codexDefinition,
    exports.opencodeDefinition,
];
const byId = new Map(exports.AGENT_DEFINITIONS.map((definition) => [definition.id, definition]));
function getAgentDefinition(id) {
    return byId.get(id);
}
