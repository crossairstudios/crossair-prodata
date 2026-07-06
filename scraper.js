const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapePage(browser, url, game) {
    console.log(`Scrape ${game} von: ${url}`);
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 10000)); // 10s warten

    const data = await page.evaluate((game) => {
        const items = document.querySelectorAll('li[role="button"]');
        const results = [];
        
        items.forEach(item => {
            const name = item.querySelector('h2 a')?.innerText;
            const img = item.querySelector('img');
            
            // Neuer Fallback: Erst alt-Attribut, dann vielleicht im Text?
            let code = img?.getAttribute('alt')?.split(': ')[1];
            
            // Wenn Code im alt-Attribut fehlt, suchen wir in einem hidden div (siehe dein HTML-Log)
            if (!code) {
                const codeDiv = item.querySelector('div.text-xs');
                code = codeDiv?.innerText.includes('CSGO') || codeDiv?.innerText.includes('VAL-') ? codeDiv.innerText : null;
            }

            if (name && code) {
                results.push({ name, imageUrl: img?.src, code, game: game });
            }
        });
        return results;
    }, game);

    await page.close();
    return data;
}

async function run() {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    
    // Wir scrapen beide Spiele einzeln und fügen sie zusammen
    const cs2 = await scrapePage(browser, 'https://procrosshairs.com/', 'CS2');
    const valorant = await scrapePage(browser, 'https://procrosshairs.com/valorant', 'Valorant');
    
    const all = [...cs2, ...valorant];
    fs.writeFileSync('./presets.json', JSON.stringify(all, null, 2));
    console.log(`Fertig! ${all.length} Presets gefunden (${cs2.length} CS2, ${valorant.length} Valorant).`);
    
    await browser.close();
}
run();
