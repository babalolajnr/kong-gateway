"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readNpmrcEntries = readNpmrcEntries;
exports.parseNpmrcContent = parseNpmrcContent;
const fs_1 = require("fs");
/**
 * Parses an .npmrc file into its `key = value` entries the way npm/npm-conf do:
 * skip blank lines and `#`/`;` comments, split on the first `=`, and trim both
 * sides. The value is returned raw (quote stripping is the caller's concern).
 * Returns null when the file is missing or unreadable so callers can distinguish
 * "no file" from "file with no relevant keys". Shared by the npm and pnpm
 * cooldown readers.
 */
function readNpmrcEntries(path) {
    if (!(0, fs_1.existsSync)(path)) {
        return null;
    }
    let raw;
    try {
        raw = (0, fs_1.readFileSync)(path, 'utf-8');
    }
    catch {
        return null;
    }
    return parseNpmrcContent(raw);
}
/** The parsing half of {@link readNpmrcEntries}, usable without a filesystem. */
function parseNpmrcContent(raw) {
    const entries = [];
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
            continue;
        }
        const eq = trimmed.indexOf('=');
        if (eq === -1) {
            continue;
        }
        entries.push({
            key: trimmed.slice(0, eq).trim(),
            value: trimmed.slice(eq + 1).trim(),
        });
    }
    return entries;
}
