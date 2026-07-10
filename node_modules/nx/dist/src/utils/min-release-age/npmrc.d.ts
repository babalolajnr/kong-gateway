export interface NpmrcEntry {
    key: string;
    value: string;
}
/**
 * Parses an .npmrc file into its `key = value` entries the way npm/npm-conf do:
 * skip blank lines and `#`/`;` comments, split on the first `=`, and trim both
 * sides. The value is returned raw (quote stripping is the caller's concern).
 * Returns null when the file is missing or unreadable so callers can distinguish
 * "no file" from "file with no relevant keys". Shared by the npm and pnpm
 * cooldown readers.
 */
export declare function readNpmrcEntries(path: string): NpmrcEntry[] | null;
/** The parsing half of {@link readNpmrcEntries}, usable without a filesystem. */
export declare function parseNpmrcContent(raw: string): NpmrcEntry[];
