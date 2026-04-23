import { pdf } from 'pdf-to-img'

export const MAX_PDF_PAGES = 5

/**
 * Renders the first MAX_PDF_PAGES pages of a PDF to PNG buffers.
 * Uses pdf-to-img which bundles @napi-rs/canvas with prebuilt binaries
 * for Windows and linux-musl — no native compilation required on the
 * Alpine Docker image. Pages beyond the limit are silently skipped.
 */
export async function renderPdfPages(pdfBuffer: Buffer): Promise<Buffer[]> {
  const document = await pdf(pdfBuffer, { scale: 2 })
  const pages: Buffer[] = []
  let count = 0
  for await (const image of document) {
    pages.push(image)
    count++
    if (count >= MAX_PDF_PAGES) break
  }
  return pages
}
