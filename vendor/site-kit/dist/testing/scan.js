import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
/** Recursively collects built .html files. */
export async function htmlFiles(dir) {
    const out = [];
    async function walk(current) {
        let entries;
        try {
            entries = await readdir(current, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const full = join(current, entry.name);
            if (entry.isDirectory())
                await walk(full);
            else if (entry.name.endsWith(".html"))
                out.push(full);
        }
    }
    await walk(dir);
    return out;
}
/** Strips tags, scripts and styles so rules match visible copy, not markup. */
export function visibleText(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
export function excerptAround(text, index, radius = 70) {
    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + radius);
    return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}
export function relativeTo(root, file) {
    return relative(root, file) || file;
}
export async function readHtml(file) {
    return readFile(file, "utf8");
}
//# sourceMappingURL=scan.js.map