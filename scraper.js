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
    console.log("Hole Valorant Daten direkt von der ProCrosshairs API...");
    
    // Dies ist die echte API-URL, die die Seite im Hintergrund nutzt
    const url = 'https://procrosshairs.com/api/v1/valorant/players'; 
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP-Fehler: ${response.status}`);
        
        const data = await response.json();
        
        // Wir mappen die API-Daten auf dein Wunschformat
        return data.slice(0, 30).map(p => ({
            name: p.name,
            imageUrl: p.image_url, // Die API liefert das Bild direkt mit!
            code: p.crosshair_code,
            game: 'Valorant'
        }));
    } catch (e) {
        console.error("API Fehler:", e.message);
        return [];
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
