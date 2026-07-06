const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapePage(browser, url, gameName, limit = 30) {
    console.log(`Lade ${gameName} von: ${url}`);
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 7000)); // Warten, bis React gerendert hat

    const data = await page.evaluate((limit, gameName) => {
        const players = [];
        // Wir suchen alle Buttons, die Spieler-Kacheln sein könnten
        const items = document.querySelectorAll('li[role="button"]');
        
        items.forEach((item) => {
            if (players.length >= limit) return;
            
            // Neuer flexiblerer Ansatz: Suche den Textinhalt (Name) und das Bild
            // Da wir nicht genau wissen, welches Tag der Name ist, nehmen wir den 
            // Textinhalt der ersten paar Elemente innerhalb des Buttons
            const name = item.querySelector('h3')?.innerText.trim() || 
                         item.querySelector('span')?.innerText.trim();
            const img = item.querySelector('img');
            
            // Code aus dem alt-Attribut
            const altText = img?.getAttribute('alt') || "";
            const code = altText.split(': ')[1] || "";

            if (name && img?.src && code) {
                players.push({ name, imageUrl: img.src, code, game: gameName });
            }
        });
        return players;
    }, limit, gameName);

    await page.close();
    return data;
}

async function run() {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const cs2Data = await scrapePage(browser, 'https://procrosshairs.com/', 'CS2');
    const valoData = await scrapePage(browser, 'https://procrosshairs.com/valorant', 'Valorant');

    const allPresets = [...cs2Data, ...valoData];
    fs.writeFileSync('./presets.json', JSON.stringify(allPresets, null, 2));
    console.log(`Erfolg! ${allPresets.length} Presets gespeichert.`);
    await browser.close();
}

run();
