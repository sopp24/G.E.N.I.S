/* G.E.N.I.S — lecture des fichiers fournis par l'utilisateur (pièces jointes). Les bibliothèques d'extraction sont chargées à la demande
   (versions épinglées) : rien n'est téléchargé tant qu'aucun fichier PDF/Office/image n'est lu. */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs', PDFW = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
export const MAX_BYTES = 15 * 1048576, MAX_CHARS = 60000;
const TEXT = /\.(txt|md|csv|tsv|json|html?|xml|log|ya?ml|js|ts|css|py|java|c|cpp|cs|sql|sh|ini|toml)$/i;
async function pdfText(file) {
  const pdfjs = await import(PDFJS); pdfjs.GlobalWorkerOptions.workerSrc = PDFW;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; let out = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 80) && out.length < MAX_CHARS; i++) out += `\n[Page ${i}]\n` + (await (await pdf.getPage(i)).getTextContent()).items.map(x => x.str).join(' ');
  return out;
}
async function docxText(file) { const m = await import('https://esm.sh/mammoth@1.9.0'); return String((await (m.default || m).extractRawText({ arrayBuffer: await file.arrayBuffer() })).value || ''); }
async function xlsxText(file) { const m = await import('https://esm.sh/xlsx@0.18.5'), X = m.default || m, book = X.read(await file.arrayBuffer(), { type: 'array' }); return book.SheetNames.slice(0, 10).map(n => `[Feuille : ${n}]\n${X.utils.sheet_to_csv(book.Sheets[n])}`).join('\n\n'); }
async function pptxText(file) {
  const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default, zip = await JSZip.loadAsync(await file.arrayBuffer());
  const names = Object.keys(zip.files).filter(x => /^ppt\/slides\/slide\d+\.xml$/.test(x)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/))), out = [];
  for (const [i, n] of names.entries()) out.push(`[Diapositive ${i + 1}]\n` + [...(await zip.files[n].async('string')).matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m => m[1]).join(' '));
  return out.join('\n\n');
}
async function ocrText(file) {
  const T = await import('https://esm.sh/tesseract.js@5.1.1'), create = T.createWorker || T.default?.createWorker; if (!create) throw new Error('Moteur de reconnaissance de texte indisponible.');
  const w = await create('fra+eng'); try { return (await w.recognize(file)).data.text; } finally { await w.terminate(); }
}
/** Retourne { name, size, text, truncated }. Lève une erreur lisible si le format n'est pas pris en charge. */
export async function extractFile(file) {
  if (file.size > MAX_BYTES) throw new Error(`« ${file.name} » dépasse ${MAX_BYTES / 1048576} Mo.`);
  const n = file.name, t = file.type || '', ext = (n.split('.').pop() || '').toLowerCase(); let text;
  if (TEXT.test(n) || t.startsWith('text/') || t === 'application/json') text = await file.text();
  else if (ext === 'pdf' || t === 'application/pdf') text = await pdfText(file);
  else if (ext === 'docx') text = await docxText(file);
  else if (ext === 'xlsx' || ext === 'xls') text = await xlsxText(file);
  else if (ext === 'pptx') text = await pptxText(file);
  else if (t.startsWith('image/')) text = await ocrText(file);
  else throw new Error('Format non pris en charge. Formats acceptés : texte, CSV, JSON, HTML, PDF, DOCX, XLSX, PPTX et images.');
  text = String(text).replace(/\u0000/g, '').trim();
  if (!text) throw new Error(`Aucun texte lisible dans « ${n} ».`);
  return { name: n, size: file.size, text: text.slice(0, MAX_CHARS), truncated: text.length > MAX_CHARS };
}
