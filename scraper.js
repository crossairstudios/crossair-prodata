const puppeteer = require('puppeteer');
const fs = require('fs');

async function run() {
    console.log("Scraper gestartet...");
    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: "new", 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        console.log("Browser gestartet.");
        
        // ... hier dein restlicher Code ...
        
    } catch (error) {
        console.error("FATALER FEHLER BEIM SCRAPING:", error);
        process.exit(1); // Erzwingt Fehler im GitHub Action Workflow
    } finally {
        if (browser) await browser.close();
    }
}
run();
