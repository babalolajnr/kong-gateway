"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canPrompt = canPrompt;
exports.migratePrompt = migratePrompt;
const enquirer_1 = require("enquirer");
const is_ci_1 = require("../../utils/is-ci");
const output_1 = require("../../utils/output");
/**
 * Whether `nx migrate` may show interactive prompts: requires a TTY on stdin,
 * not running in CI, and the user not having passed `--no-interactive`.
 */
function canPrompt(interactive) {
    return !!process.stdin.isTTY && !(0, is_ci_1.isCI)() && interactive !== false;
}
/**
 * Drop-in replacement for enquirer's `prompt()` that hardens cancel
 * handling for every interactive prompt under `nx migrate`.
 *
 * Why: enquirer's built-in cancel path (`Prompt.cancel` → `close` →
 * `keypress.js` `off` → `readline.pause`) races on `Interface.pause()`
 * when triggered more than once in quick succession (mashed Ctrl+C),
 * throwing `ERR_USE_AFTER_CLOSE` from an unhandled async chain that
 * `await prompt(...)` cannot catch.
 *
 * In raw mode, Ctrl+C does NOT generate a SIGINT signal (the kernel's
 * `ISIG` flag is cleared while enquirer's keypress listener is active);
 * instead the 0x03 byte flows through `combos.js` and dispatches the
 * `cancel` action. So a `process.on('SIGINT', ...)` handler is the wrong
 * mechanism here — it never fires.
 *
 * The right hook is enquirer's per-prompt `options.cancel` override. When
 * present, `Prompt.keypress` (lib/prompt.js:42) calls our handler INSTEAD
 * of `this.cancel`, so enquirer's broken cleanup never runs. Both Ctrl+C
 * (byte 0x03) and Esc map to the `cancel` action, so this single override
 * covers both paths.
 *
 * The handler emits a single-line notice via `output.warn` and exits with
 * POSIX status 130 (128 + SIGINT). Synchronous exit is correct here: the
 * user explicitly asked to abort, there's no recovery state to preserve.
 */
async function migratePrompt(questions) {
    const cancel = () => {
        // `\n\r` → next line at column 0 (enquirer left the TTY in raw mode,
        //   so a bare LF would not carry an implicit CR).
        // `\x1B[J` → clear from cursor to end of screen. Wipes enquirer's
        //   leftover choice / input rendering below the row where we'll
        //   write our message so the exit output isn't shadowed by orphaned
        //   prompt fragments.
        process.stdout.write('\n\r\x1B[J');
        output_1.output.warn({ title: 'nx migrate interrupted by user.' });
        process.exit(130);
    };
    const withCancel = (q) => ({ ...q, cancel });
    const injected = Array.isArray(questions)
        ? questions.map(withCancel)
        : withCancel(questions);
    return (await (0, enquirer_1.prompt)(injected));
}
