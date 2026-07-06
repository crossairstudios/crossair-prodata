const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapePage(browser, url, gameName) {
    console.log(`--- Diagnose für ${gameName} ---`);
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 7000)); // Längere Wartezeit

        const data = await page.evaluate(() => {
            // Wir suchen jetzt nach JEDEM li-Element, um zu sehen, was da ist
            const allListItems = document.querySelectorAll('li');
            const debugInfo = [];
            
            allListItems.forEach((li, index) => {
                if(index < 5) { // Nur die ersten 5 zeigen
                    debugInfo.push(li.outerHTML.substring(0, 100));
                }
            });

            // Wir versuchen einen flexibleren Selektor
            const items = document.querySelectorAll('a[href*="/valorant/"]'); 
            return { debugInfo, itemCount: allListItems.length, linkCount: items.length };
        });

        console.log(`Anzahl aller LI-Elemente: ${data.itemCount}`);
        console.log(`Beispiele: ${JSON.stringify(data.debugInfo)}`);
        
        return []; // Wir geben absichtlich erst mal nichts zurück, um das Log zu sehen
    } catch (e) {
        console.error(`Fehler bei ${gameName}:`, e.message);
        return [];
    } finally {
        await page.close();
    }
}

async function run() {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    await scrapePage(browser, 'https://procrosshairs.com/valorant', 'Valorant');
    await browser.close();
}
run();
