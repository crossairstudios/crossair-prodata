const puppeteer = require('puppeteer');
const fs = require('fs');

// 1. CS2 Logik (Browser-basiert, da Codes im Alt-Text)
async function scrapeCS2(browser) {
    console.log("Scrape CS2 von procrosshairs.com...");
    const page = await browser.newPage();
    await page.goto('https://procrosshairs.com/', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000));

    const data = await page.evaluate(() => {
        const items = document.querySelectorAll('li[role="button"]');
        const results = [];
        items.forEach(item => {
            const name = item.querySelector('h2 a')?.innerText;
            const img = item.querySelector('img');
            const altText = img?.getAttribute('alt') || "";
            const code = altText.split(': ')[1] || "";
            if (name && code) {
                results.push({ name, imageUrl: img.src, code, game: 'CS2' });
            }
        });
        return results;
    });
    await page.close();
    return data;
}

// 2. Valorant Logik (API-basiert, da keine Text-Codes im DOM)
async function scrapeValorant() {
    console.log("Hole Valorant Daten via API...");
    // Wir nutzen ein öffentliches Data-Repository für Pro-Configs
    const url = 'https://raw.githubusercontent.com/pro-valorant-configs/data/main/players.json';
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // Transformieren in dein einheitliches Format
        return data.slice(0, 30).map(p => ({
            name: p.name,
            // Wir generieren die Bild-URL dynamisch über einen Image-Service
            imageUrl: `https://api.valorant-crosshair.com/render?code=${p.crosshair_code}`,
            code: p.crosshair_code,
            game: 'Valorant'
        }));
    } catch (e) {
        console.error("Valorant API Fehler:", e);
        return []; // Fallback bei Fehler
    }
}

// 3. Haupt-Workflow
async function run() {
    const browser = await puppeteer.launch({ 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const cs2Data = await scrapeCS2(browser);
    const valorantData = await scrapeValorant();
    
    const allPresets = [...cs2Data, ...valorantData];
    
    fs.writeFileSync('./presets.json', JSON.stringify(allPresets, null, 2));
    console.log(`Fertig! ${allPresets.length} Presets gespeichert (${cs2Data.length} CS2, ${valorantData.length} Valorant).`);
    
    await browser.close();
}

run();
