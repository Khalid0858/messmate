import fs from "node:fs";
import ts from "typescript";
import { spawnSync } from "node:child_process";
fs.mkdirSync(".sites-runtime/tests", { recursive: true });
for (const [src, dest] of [
  ["lib/ledger.ts", "ledger.mjs"],
  ["lib/actions.ts", "actions.mjs"],
  ["tests/ledger.test.ts", "ledger-tests.mjs"],
]) {
  const code = fs.readFileSync(src, "utf8").replace(
    /(["'])(?:\.\.\/lib\/|\.\/)(ledger|actions)\1/g,
    '"./$2.mjs"',
  );
  fs.writeFileSync(
    ".sites-runtime/tests/" + dest,
    ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText,
  );
}
const result = spawnSync(
  process.execPath,
  ["--test", ".sites-runtime/tests/ledger-tests.mjs"],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
