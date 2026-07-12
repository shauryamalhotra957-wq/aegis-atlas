import { mkdir, stat } from 'node:fs/promises'
import { chromium } from 'playwright'

const targetUrl = process.env.AEGIS_URL ?? 'http://127.0.0.1:4173'
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 900 },
]

await mkdir('qa', { recursive: true })

const browser = await chromium.launch()

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport })
    await page.goto(targetUrl, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: /Disaster Response Command/i }).waitFor()
    await page.getByRole('img', { name: /City risk map/i }).waitFor()

    const zoneCount = await page.locator('.zone-node').count()
    if (zoneCount < 12) {
      throw new Error(`Expected at least 12 map zones, found ${zoneCount}`)
    }

    const mapBox = await page.locator('.map-shell').boundingBox()
    if (!mapBox || mapBox.width < 280 || mapBox.height < 180) {
      throw new Error(`Map is not visibly framed in ${viewport.name}`)
    }

    const buttonBoxes = await page.locator('button').evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect()
        return { width: rect.width, height: rect.height, text: button.textContent ?? '' }
      }),
    )
    const brokenButton = buttonBoxes.find((box) => box.width < 36 || box.height < 36)
    if (brokenButton) {
      throw new Error(`Button target too small in ${viewport.name}: ${brokenButton.text}`)
    }

    const screenshotPath = `qa/aegis-${viewport.name}.png`
    await page.screenshot({ path: screenshotPath, fullPage: true })
    const screenshotStats = await stat(screenshotPath)
    if (screenshotStats.size < 35_000) {
      throw new Error(`Screenshot looks blank or incomplete in ${viewport.name}`)
    }

    await page.close()
  }
} finally {
  await browser.close()
}

console.log(`Visual QA passed against ${targetUrl}`)
