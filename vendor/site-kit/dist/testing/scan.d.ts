export interface Finding {
    readonly file: string;
    readonly rule: string;
    readonly excerpt: string;
    readonly message: string;
}
export interface ScanResult {
    readonly findings: readonly Finding[];
    readonly filesScanned: number;
}
/** Recursively collects built .html files. */
export declare function htmlFiles(dir: string): Promise<string[]>;
/** Strips tags, scripts and styles so rules match visible copy, not markup. */
export declare function visibleText(html: string): string;
export declare function excerptAround(text: string, index: number, radius?: number): string;
export declare function relativeTo(root: string, file: string): string;
export declare function readHtml(file: string): Promise<string>;
//# sourceMappingURL=scan.d.ts.map