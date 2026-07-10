import { AgentRulesOptions } from './set-up-ai-agents/get-agent-rules';
export type { AgentRulesOptions };
export declare function agentsMdPath(root: string): string;
export declare function geminiMdPath(root: string): string;
export declare function parseGeminiSettings(root: string): any | undefined;
export declare function geminiSettingsPath(root: string): string;
export declare function claudeMdPath(root: string): string;
export declare function claudeMcpJsonPath(root: string): string;
export declare function opencodeMcpPath(root: string): string;
export declare function codexConfigTomlPath(root: string): string;
export declare const nxRulesMarkerCommentStart = "<!-- nx configuration start-->";
export declare const nxRulesMarkerCommentDescription = "<!-- Leave the start & end comments to automatically receive updates. -->";
export declare const nxRulesMarkerCommentEnd = "<!-- nx configuration end-->";
export declare const rulesRegex: RegExp;
export interface AgentRulesWrappedOptions {
    writeNxCloudRules: boolean;
    useH1?: boolean;
}
export declare const getAgentRulesWrapped: (options: AgentRulesWrappedOptions) => string;
/**
 * Hostname Nx analytics events are sent to (GA4 Measurement Protocol).
 * Must stay in sync with GA_ENDPOINT in packages/nx/src/native/telemetry/constants.rs.
 */
export declare const analyticsDomain = "www.google-analytics.com";
export declare const nxMcpTomlHeader = "[mcp_servers.\"nx-mcp\"]";
/**
 * Get the MCP TOML configuration based on the Nx version.
 * For Nx 22+, uses 'nx mcp'
 * For Nx < 22, uses 'nx-mcp'
 */
export declare function getNxMcpTomlConfig(nxVersion: string): string;
