/**
 * @jest-environment node
 */
import { renderPdfPages, MAX_PDF_PAGES } from '@/lib/pdf/render-pages'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('renderPdfPages', () => {
  it('renders pages as PNG buffers, capped at MAX_PDF_PAGES', async () => {
    const pdfPath = join(__dirname, 'fixtures', 'sample.pdf')
    const buffer = readFileSync(pdfPath)
    const pages = await renderPdfPages(buffer)
    expect(pages.length).toBeGreaterThan(0)
    expect(pages.length).toBeLessThanOrEqual(MAX_PDF_PAGES)
    for (const png of pages) {
      expect(png[0]).toBe(0x89)
      expect(png[1]).toBe(0x50)
      expect(png[2]).toBe(0x4e)
      expect(png[3]).toBe(0x47)
    }
  })
})
