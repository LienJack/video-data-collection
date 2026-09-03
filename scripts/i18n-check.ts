import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { assertCatalogParity, catalogs, SUPPORTED_LOCALES } from "@egocapture/core/i18n";
import ts from "typescript";

const workspaceRoot = process.cwd();
const appRoots = ["apps/admin-web/app", "apps/participant-web/app"];

// Product names and protocol/measurement identifiers are intentionally stable
// across locales. `content_hash` is displayed as an original evidence key.
const allowedJsxCopy = new Set([
  "EgoCapture",
  "EgoCapture Ops",
  "FPS",
  "FPS ·",
  "MiB /",
  "content_hash",
]);
const userFacingAttributes = new Set(["aria-label", "placeholder", "title", "alt", "blankLabel"]);

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(path.join(workspaceRoot, directory), { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(relative);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [relative] : [];
  }));
  return nested.flat();
}

async function checkApplicationCopy() {
  const violations: string[] = [];
  for (const root of appRoots) {
    for (const file of await sourceFiles(root)) {
      // Route handlers keep stable server-side diagnostic/audit text; clients render
      // their code through the locale catalog and never surface these messages.
      if (file.includes("/app/api/") || file.endsWith("/system-guide/guide-content.ts")) continue;
      const source = await readFile(path.join(workspaceRoot, file), "utf8");
      source.split("\n").forEach((line, index) => {
        if (/\p{Script=Han}/u.test(line)) violations.push(`${file}:${index + 1}: hardcoded Han UI copy`);
      });

      if (!file.endsWith(".tsx")) continue;
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const reportLiteral = (node: ts.Node, value: string, kind: string) => {
        const normalized = value.replace(/\s+/g, " ").trim();
        if (!normalized || !/\p{L}/u.test(normalized) || allowedJsxCopy.has(normalized)) return;
        if (normalized === "admin" || /^PT-X+$/.test(normalized)) return;
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        violations.push(`${file}:${line + 1}: hardcoded ${kind} copy: ${JSON.stringify(normalized)}`);
      };
      const visit = (node: ts.Node): void => {
        if (ts.isJsxText(node)) reportLiteral(node, node.getText(sourceFile), "JSX");
        if (ts.isJsxAttribute(node) && userFacingAttributes.has(node.name.getText(sourceFile)) && node.initializer && ts.isStringLiteral(node.initializer)) {
          reportLiteral(node, node.initializer.text, "attribute");
        }
        if (
          ts.isCallExpression(node)
          && ts.isIdentifier(node.expression)
          && ["setError", "setStatus", "setCopyStatus"].includes(node.expression.text)
          && node.arguments.length === 1
          && ts.isStringLiteral(node.arguments[0]!)
        ) {
          reportLiteral(node, node.arguments[0]!.text, "client error/status");
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }
  }
  if (violations.length > 0) throw new Error(`Hardcoded application copy found:\n${violations.join("\n")}`);
}

async function checkGuideAssets() {
  const diagrams = ["system-architecture", "system-workflow", "multipart-resume", "live-recording"];
  const contentByDiagram = new Map<string, Set<string>>();
  for (const locale of SUPPORTED_LOCALES) {
    for (const diagram of diagrams) {
      const relative = `apps/admin-web/public/system-guide/diagrams/${locale}/${diagram}.html`;
      const source = await readFile(path.join(workspaceRoot, relative), "utf8");
      if (!source.includes(`<html lang="${locale}">`)) throw new Error(`Guide asset language mismatch: ${relative}`);
      if (!/<title>[^<]+<\/title>/.test(source)) throw new Error(`Guide asset title missing: ${relative}`);
      if (locale === "zh-CN" && !/\p{Script=Han}/u.test(source)) throw new Error(`Chinese guide copy missing: ${relative}`);
      if (locale === "en" && /\p{Script=Han}/u.test(source)) throw new Error(`English guide contains Han UI copy: ${relative}`);
      if (locale === "ja" && !/[\u3040-\u30ff]/u.test(source)) throw new Error(`Japanese guide copy missing: ${relative}`);
      const localizedSources = contentByDiagram.get(diagram) ?? new Set<string>();
      localizedSources.add(source);
      contentByDiagram.set(diagram, localizedSources);
    }
  }
  for (const [diagram, localizedSources] of contentByDiagram) {
    if (localizedSources.size !== SUPPORTED_LOCALES.length) throw new Error(`Guide asset copy duplicated across locales: ${diagram}`);
  }
}

async function main() {
  assertCatalogParity();
  for (const locale of SUPPORTED_LOCALES) {
    for (const [code, message] of Object.entries(catalogs[locale].errors)) {
      if (!message.trim()) throw new Error(`Empty error translation: ${locale}:${code}`);
    }
  }
  await Promise.all([checkApplicationCopy(), checkGuideAssets()]);
  console.log("i18n catalogs, application copy, and localized guide assets verified");
}

void main();
