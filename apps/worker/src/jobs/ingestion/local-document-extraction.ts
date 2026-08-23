import { resolve } from "node:path";
import sharp from "sharp";
import { OEM, PSM, createWorker, type Worker } from "tesseract.js";
import {
  definePDFJSModule,
  extractText,
  getDocumentProxy,
  renderPageAsImage,
} from "unpdf";

let ocrWorkerPromise: Promise<Worker> | null = null;
let pdfModulePromise: Promise<void> | null = null;

export async function extractImageTextLocally(buffer: Buffer) {
  const prepared = await sharp(buffer, { failOn: "none" })
    .rotate()
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
  const worker = await getOcrWorker();
  const result = await worker.recognize(prepared);
  return normalizeExtractedText(result.data.text);
}

export async function extractPdfTextLocally(buffer: Buffer) {
  await ensureOfficialPdfModule();
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const extracted = await extractText(pdf, { mergePages: false });
  const textPages = extracted.text.map(normalizeExtractedText).filter(Boolean);

  if (textPages.join("\n").length >= 40) {
    return formatPdfPages(textPages);
  }

  const pageCount = Math.min(pdf.numPages, getPdfOcrPageLimit());
  const ocrPages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const rendered = await renderPageAsImage(pdf, pageNumber, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale: 2,
    });
    if (typeof rendered === "string") continue;
    const pageText = await extractImageTextLocally(Buffer.from(rendered));
    if (pageText) ocrPages.push(pageText);
  }

  return formatPdfPages(ocrPages);
}

function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker("eng+vie", OEM.LSTM_ONLY, {
      cachePath: resolve(process.cwd(), ".cache", "tesseract"),
    }).then(async (worker) => {
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: PSM.AUTO,
      });
      return worker;
    });
    ocrWorkerPromise.catch(() => {
      ocrWorkerPromise = null;
    });
  }
  return ocrWorkerPromise;
}

function ensureOfficialPdfModule() {
  pdfModulePromise ??= definePDFJSModule(() => import("pdfjs-dist"));
  return pdfModulePromise;
}

function getPdfOcrPageLimit() {
  const configured = Number(process.env.PDF_OCR_MAX_PAGES ?? 30);
  if (!Number.isFinite(configured)) return 30;
  return Math.min(Math.max(Math.trunc(configured), 1), 100);
}

function formatPdfPages(pages: string[]) {
  return pages
    .map((text, index) => `## Page ${index + 1}\n${text}`)
    .join("\n\n")
    .trim();
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
