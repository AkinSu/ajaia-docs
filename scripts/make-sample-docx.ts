/**
 * Writes `samples/sample.docx`.
 *
 * No docx-writing library is installed, so we assemble the OOXML parts by hand
 * and zip them with JSZip, which is already present as a mammoth dependency
 * (`require.resolve("jszip")` resolves). Keeping the builder exported means
 * lib/convert.test.ts can generate the same fixture in memory for a real
 * round-trip test instead of committing a binary blob.
 *
 * Run with: npx tsx scripts/make-sample-docx.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

/**
 * mammoth's default style map matches on the style id (`p.Heading1 => h1`) as
 * well as the human style name, so both are declared here.
 */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
  </w:style>
</w:styles>`;

/**
 * A single abstract numbering definition with numFmt="bullet" at level 0.
 * mammoth resolves `w:numPr` through this file to decide that a paragraph is an
 * unordered list item, which is what turns the bullets into `<ul><li>`.
 */
const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="&#8226;"/>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
  </w:num>
</w:numbering>`;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function run(text: string, opts: { bold?: boolean; italic?: boolean } = {}) {
  const props: string[] = [];
  if (opts.bold) props.push("<w:b/>");
  if (opts.italic) props.push("<w:i/>");
  const rPr = props.length > 0 ? `<w:rPr>${props.join("")}</w:rPr>` : "";
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function paragraph(
  runs: string[],
  opts: { style?: string; bullet?: boolean } = {},
) {
  const props: string[] = [];
  if (opts.style) props.push(`<w:pStyle w:val="${opts.style}"/>`);
  if (opts.bullet) {
    props.push('<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>');
  }
  const pPr = props.length > 0 ? `<w:pPr>${props.join("")}</w:pPr>` : "";
  return `<w:p>${pPr}${runs.join("")}</w:p>`;
}

const DOCUMENT_BODY = [
  paragraph([run("Sample Imported Document")], { style: "Heading1" }),
  paragraph([
    run("This paragraph contains a "),
    run("bold run", { bold: true }),
    run(" and an "),
    run("italic run", { italic: true }),
    run(" so the importer can prove marks survive the round trip."),
  ]),
  paragraph([run("What this fixture covers")], { style: "Heading2" }),
  paragraph([run("A level-one heading")], {
    style: "ListParagraph",
    bullet: true,
  }),
  paragraph([run("A paragraph with bold and italic marks")], {
    style: "ListParagraph",
    bullet: true,
  }),
  paragraph([run("A bulleted list, like this one")], {
    style: "ListParagraph",
    bullet: true,
  }),
].join("");

const DOCUMENT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${DOCUMENT_BODY}<w:sectPr/></w:body>
</w:document>`;

/** Build the sample .docx in memory and return its bytes. */
export async function buildSampleDocx(): Promise<Buffer> {
  const zip = new JSZip();
  // `[Content_Types].xml` must be stored first for the package to be readable
  // by strict OOXML consumers; JSZip preserves insertion order.
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", ROOT_RELS);
  zip.file("word/document.xml", DOCUMENT);
  zip.file("word/_rels/document.xml.rels", DOCUMENT_RELS);
  zip.file("word/styles.xml", STYLES);
  zip.file("word/numbering.xml", NUMBERING);

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.join(here, "..", "samples", "sample.docx");
  const bytes = await buildSampleDocx();
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, bytes);
  console.log(`Wrote ${outPath} (${bytes.byteLength} bytes)`);
}

// Only write the file when the script is executed directly, so importing
// `buildSampleDocx` from a test has no side effects.
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
