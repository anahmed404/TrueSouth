// Generates src/contracts/generated.ts from src/contracts/schema.json.
// Run with `pnpm --dir web gen:types` after `uv run truesouth export-schema`.
//
// Pydantic gives every property a `title`. json-schema-to-typescript turns each titled
// property into its own named alias (`Id3`, `Name13`), which buries the real field types.
// So property titles are dropped before generating; model titles and every description stay.
import { readFile, writeFile } from "node:fs/promises";
import { compile } from "json-schema-to-typescript";

const schemaUrl = new URL("../src/contracts/schema.json", import.meta.url);
const outputUrl = new URL("../src/contracts/generated.ts", import.meta.url);

function dropTitles(node) {
  if (Array.isArray(node)) {
    node.forEach(dropTitles);
    return;
  }
  if (node === null || typeof node !== "object") return;
  delete node.title;
  Object.values(node).forEach(dropTitles);
}

const schema = JSON.parse(await readFile(schemaUrl, "utf8"));
for (const model of Object.values(schema.$defs)) {
  const { title } = model;
  dropTitles(model);
  if (title !== undefined) model.title = title;
}

const generated = await compile(schema, "TrueSouthContracts", {
  bannerComment: "/* generated from schema.json by `pnpm gen:types`, do not edit */",
  unreachableDefinitions: true,
});

await writeFile(outputUrl, generated.replace(/\r\n/g, "\n"), "utf8");
