import type * as ts from 'typescript';
import type { Node, SyntaxKind } from 'typescript';
export declare function readTsConfig(tsConfigPath: string, sys?: ts.System): ts.ParsedCommandLine;
export declare function readTsConfigWithoutFiles(tsConfigPath: string): ts.ParsedCommandLine;
export declare function readTsConfigOptions(tsConfigPath: string): ts.CompilerOptions;
/**
 * Find a module based on its import
 *
 * @param importExpr Import used to resolve to a module
 * @param filePath
 * @param tsConfigPath
 */
export declare function resolveModuleByImport(importExpr: string, filePath: string, tsConfigPath: string): string;
export declare function getRootTsConfigFileName(): string | null;
export declare function getRootTsConfigPath(): string | null;
export declare function getRootTsConfigCustomConditions(root?: string): string[];
/**
 * Conditions list for `resolve.exports`: workspace `customConditions` plus
 * `development` as backward-compat for workspaces not yet migrated by
 * `migrate-development-custom-condition` (21.5).
 */
export declare function getRootTsConfigResolveExportsConditions(root?: string): string[];
export declare function findNodes(node: Node, kind: SyntaxKind | SyntaxKind[], max?: number): Node[];
