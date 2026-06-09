import puppeteer from 'puppeteer';
import GIFEncoder from 'gif-encoder-2';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const DEMO_DIR = path.resolve('demo');

// Create directory if it doesn't exist
if (!fs.existsSync(DEMO_DIR)) {
  fs.mkdirSync(DEMO_DIR, { recursive: true });
}

async function clickByText(page, text) {
  await page.evaluate((textToFind) => {
    // Find all potential clickable elements
    const elements = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
    // Try exact match first
    const target = elements.find(el => el.textContent && el.textContent.trim() === textToFind);
    if (target) {
      target.click();
    } else {
      // Fallback to fuzzy match
      const fuzzyTarget = elements.find(el => el.textContent && el.textContent.includes(textToFind));
      if (fuzzyTarget) fuzzyTarget.click();
    }
  }, text);
}

async function run() {
  console.log('Starting browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  console.log('Navigating to https://fixture-kit.vercel.app ...');
  await page.goto('https://fixture-kit.vercel.app', { waitUntil: 'networkidle0' });

  const screenshotBuffers = [];
  let recording = true;
  let frameCount = 0;

  // Background loop to take screenshots every 150ms
  const takeScreenshot = async () => {
    if (!recording) return;
    try {
      const buffer = await page.screenshot(); // returns a Buffer directly
      screenshotBuffers.push(buffer);
      frameCount++;
    } catch (e) {
      // Ignore errors if the page is closed or navigation happens
    }
    if (recording) {
      setTimeout(takeScreenshot, 150);
    }
  };

  console.log('Starting recording...');
  takeScreenshot();

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  // Perform actions sequence
  console.log('Waiting 1 second on empty state...');
  await wait(1000);

  console.log('Clicking "User" example button...');
  await clickByText(page, 'User');
  
  console.log('Waiting 1.5 seconds...');
  await wait(1500);

  console.log('Clicking "JSON" tab...');
  await clickByText(page, 'JSON');

  console.log('Waiting 1 second...');
  await wait(1000);

  console.log('Clicking "MSW" tab...');
  await clickByText(page, 'MSW');

  console.log('Waiting 1 second...');
  await wait(1000);

  console.log('Clicking back to "TypeScript" tab...');
  await clickByText(page, 'TypeScript');

  console.log('Waiting 0.5 seconds...');
  await wait(500);

  console.log('Clicking "Copy" button...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find(b => b.textContent && b.textContent.includes('Copy'));
    if (target) {
      target.click();
    } else {
      // Fallback: look for icon or title with 'copy'
      const svg = document.querySelector('svg[class*="copy"], svg[id*="copy"], button[title*="Copy"]');
      if (svg) {
        const btn = svg.closest('button');
        if (btn) btn.click();
      }
    }
  });

  console.log('Waiting 1 second...');
  await wait(1000);

  recording = false;
  console.log('Stopping recording, waiting for pending screenshots...');
  await wait(500); // Give time for last screenshots to complete

  await browser.close();

  console.log(`Generating GIF with ${screenshotBuffers.length} frames...`);

  // Initialize gif-encoder-2
  const encoder = new GIFEncoder(1280, 720);
  
  encoder.start();
  encoder.setRepeat(0);   // loop infinitely
  encoder.setDelay(100);  // 100ms frame delay (playback speed)
  encoder.setQuality(10); // image quality

  // Process and add each screenshot frame
  for (let i = 0; i < screenshotBuffers.length; i++) {
    const buffer = screenshotBuffers[i];
    try {
      // Decode the PNG buffer using pngjs to get raw RGBA pixels
      const png = PNG.sync.read(buffer);
      
      // Pass the raw pixel data directly to gif-encoder-2
      encoder.addFrame(png.data);

      // Log progress every 10 frames
      if (i > 0 && i % 10 === 0) {
        console.log(`Processed frame ${i}/${screenshotBuffers.length}`);
      }
    } catch (e) {
      console.log(`Failed to process frame ${i}: ${e.message}`);
    }
  }

  encoder.finish();

  // Save the final GIF buffer to disk
  const gifBuffer = encoder.out.getData();
  fs.writeFileSync(path.join(DEMO_DIR, 'demo.gif'), gifBuffer);

  console.log('Done! Saved GIF to demo/demo.gif');
}

run().catch(console.error);
