import puppeteer from 'puppeteer'

async function run() {
  console.log('🚀 Starting Chaos Testing & Memory Leak Detection')
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()

  let errors = 0
  let warnings = 0
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors++
      console.error(`[Browser Error]: ${msg.text()}`)
    }
    if (msg.type() === 'warning') {
      warnings++
      console.warn(`[Browser Warning]: ${msg.text()}`)
    }
  })
  
  page.on('pageerror', err => {
    errors++
    console.error(`[Uncaught Exception]: ${err.toString()}`)
  })
  
  page.on('requestfailed', request => {
    errors++
    console.error(`[Failed Request]: ${request.url()} - ${request.failure()?.errorText}`)
  })

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' })
  console.log('✅ Connected to localhost:5173')

  console.log('── Running Real User Chaos Testing ──')
  // 1. Rapid Theme/Adversarial/Randomized clicking
  for (let i = 0; i < 50; i++) {
    await page.evaluate(() => {
      const switches = document.querySelectorAll('button[role="switch"]')
      switches.forEach(s => s.click())
    })
  }
  
  // 2. Change count rapidly
  for (let i = 0; i < 20; i++) {
    await page.evaluate((val) => {
      const input = document.querySelector('input[type="number"]')
      if (input) {
        input.value = val;
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }, Math.floor(Math.random() * 100))
  }
  
  // 3. Paste complex schema rapidly
  const massiveSchema = `
    interface User {
      id: string;
      name: string;
      nested: { deeply: { nested: { value: number[] } } }
    }
  `.repeat(100)
  
  await page.evaluate((schema) => {
    // Attempt to find Monaco and set value
    if (window.monaco) {
      window.monaco.editor.getModels()[0].setValue(schema)
    }
  }, massiveSchema)
  
  await new Promise(r => setTimeout(r, 2000))
  
  // 4. Memory Leak Snapshot
  console.log('── Collecting Memory Metrics ──')
  const metrics = await page.metrics()
  console.log(`JS Heap Used: ${(metrics.JSHeapUsedSize / 1024 / 1024).toFixed(2)} MB`)
  console.log(`JS Heap Total: ${(metrics.JSHeapTotalSize / 1024 / 1024).toFixed(2)} MB`)
  console.log(`Nodes: ${metrics.Nodes}`)
  console.log(`Listeners: ${metrics.JSEventListeners}`)
  
  // Wait a bit and check again
  await new Promise(r => setTimeout(r, 3000))
  const metrics2 = await page.metrics()
  console.log(`JS Heap Used (after 3s): ${(metrics2.JSHeapUsedSize / 1024 / 1024).toFixed(2)} MB`)
  
  console.log(`\nChaos Testing Complete. Errors: ${errors}, Warnings: ${warnings}`)
  await browser.close()
}

run().catch(err => {
  console.error('Test Failed:', err)
  process.exit(1)
})
