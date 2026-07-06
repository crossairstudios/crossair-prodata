const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapePage(browser, url, game) {
    console.log(`Scrape ${game} von: ${url}`);
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    // Warte kurz, damit die Liste geladen wird
    await new Promise(r => setTimeout(r, 5000));

    const data = await page.evaluate((game) => {
        const items = document.querySelectorAll('li[role="button"]');
        const results = [];
        
        items.forEach(item => {
            const name = item.querySelector('h2 a')?.innerText;
            const img = item.querySelector('img');
            const altText = img?.getAttribute('alt') || "";
            
            // Der Code ist alles nach dem Doppelpunkt im alt-Text
            const code = altText.split(': ')[1] || "";
            
            if (name && code) {
                results.push({
                    name: name,
                    imageUrl: img.src,
                    code: code,
                    game: game
                });
            }
        });
        return results;
    }, game);

    await page.close();
    return data;
}

async function run() {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    
    const cs2 = await scrapePage(browser, 'https://procrosshairs.com/', 'CS2');
    const valorant = await scrapePage(browser, 'https://procrosshairs.com/valorant', 'Valorant');
    
    const all = [...cs2, ...valorant];
    fs.writeFileSync('./presets.json', JSON.stringify(all, null, 2));
    console.log(`Fertig! ${all.length} Presets gefunden.`);
    
    await browser.close();
}
run();
