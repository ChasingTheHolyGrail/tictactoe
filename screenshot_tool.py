#!/usr/bin/env python3
"""
Screenshot capture tool for Tic Tac Toe UI
Uses Playwright to capture screenshots of the HTML file
"""
import asyncio
import sys
from pathlib import Path

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Playwright not installed. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright"])
    subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
    from playwright.async_api import async_playwright

async def capture_screenshot(html_path, output_path="screenshot.png", width=1280, height=720):
    """Capture a screenshot of the HTML file"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": width, "height": height})
        
        # Convert to file:// URL
        html_file = Path(html_path).absolute()
        file_url = f"file:///{html_file.as_posix()}"
        
        await page.goto(file_url, wait_until="networkidle")
        
        # Wait a bit for animations to settle
        await asyncio.sleep(1)
        
        await page.screenshot(path=output_path, full_page=True)
        await browser.close()
        
        print(f"Screenshot saved to: {output_path}")

if __name__ == "__main__":
    html_file = sys.argv[1] if len(sys.argv) > 1 else "index.html"
    output_file = sys.argv[2] if len(sys.argv) > 2 else "screenshot.png"
    
    asyncio.run(capture_screenshot(html_file, output_file))
