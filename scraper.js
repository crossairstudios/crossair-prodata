const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapePage(browser, url, gameName) {
    console.log(`Versuche zu laden: ${gameName} -> ${url}`);
    const page = await browser.newPage();
    
    // Header setzen, damit wir nicht wie ein Bot aussehen
    await page.setExtraHTTPHeaders({
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    try {
        // Wir setzen ein hartes Timeout von 30 Sekunden
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Kleine Wartezeit für dynamisches Laden
        await new Promise(r => setTimeout(r, 5000));

        const data = await page.evaluate((gameName) => {
            const items = document.querySelectorAll('li[role="button"]');
            const list = [];
            items.forEach((item) => {
                const name = item.querySelector('h2 a')?.innerText.trim();
                const img = item.querySelector('img');
                const alt = img?.getAttribute('alt') || "";
                const code = alt.split(': ')[1] || "";
                if (name && img?.src && code) {
                    list.push({ name, imageUrl: img.src, code, game: gameName });
                }
            });
            return list;
        }, gameName);

        console.log(`${gameName} erfolgreich gescraped: ${data.length} Einträge.`);
        return data;
    } catch (e) {
        console.error(`Fehler bei ${gameName}:`, e.message);
        return [];
    } finally {
        await page.close();
    }
}

async function run() {
    console.log("Scraper gestartet...");
    const browser = await puppeteer.launch({ 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const cs2Data = await scrapePage(browser, 'https://procrosshairs.com/', 'CS2');
    const valoData = await scrapePage(browser, 'https://procrosshairs.com/valorant', 'Valorant');

    const allPresets = [...cs2Data, ...valoData];
    fs.writeFileSync('./presets.json', JSON.stringify(allPresets, null, 2));
    
    await browser.close();
    console.log("Fertig! Datei geschrieben.");
}

run();
