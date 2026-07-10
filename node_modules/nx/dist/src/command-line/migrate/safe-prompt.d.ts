import { prompt as enquirerPrompt } from 'enquirer';
/**
 * Whether `nx migrate` may show interactive prompts: requires a TTY on stdin,
 * not running in CI, and the user not having passed `--no-interactive`.
 */
export declare function canPrompt(interactive: boolean | undefined): boolean;
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
export declare function migratePrompt<T = any>(questions: Parameters<typeof enquirerPrompt>[0]): Promise<T>;
