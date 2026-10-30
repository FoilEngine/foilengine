import { readFile } from 'node:fs/promises';
import { extractText, getDocumentProxy } from 'unpdf';

/** Extracts the text of a PDF, one line per text line, pages joined by a newline. */
export async function extractPdfText(path: string): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(await readFile(path)));
  const { text } = await extractText(pdf, { mergePages: false });
  return text.join('\n');
}
