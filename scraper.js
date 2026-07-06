const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapePage(browser, url, gameName) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 7000));

    const debugData = await page.evaluate(() => {
        const item = document.querySelector('li[role="button"]'); // Wir nehmen nur das erste
        if (!item) return "Kein Button gefunden";
        
        // Wir geben den gesamten Text-Inhalt des Elements aus
        return {
            innerText: item.innerText,
            outerHTML: item.outerHTML.substring(0, 500) // Zeigt uns die internen Klassen/Strukturen
        };
    });

    console.log(`Debug für ${gameName}:`, debugData);
    await page.close();
    return [];
}

async function run() {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    await scrapePage(browser, 'https://procrosshairs.com/valorant', 'Valorant');
    await browser.close();
}
run();
