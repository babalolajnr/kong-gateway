interface MigrationShape {
    prompt?: string;
    implementation?: string;
    factory?: string;
}
export declare function isPromptOnlyMigration(m: MigrationShape): boolean;
export declare function isHybridMigration(m: MigrationShape): boolean;
export {};
