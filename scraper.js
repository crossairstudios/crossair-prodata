const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapePage(browser, url, gameName, limit = 30) {
    const page = await browser.newPage();
    // Wichtig für Headless: User-Agent setzen
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36");
    
    await page.goto(url, { waitUntil: 'networkidle2' });

    const data = await page.evaluate((limit, gameName) => {
        const players = [];
        const items = document.querySelectorAll('li[role="button"]');
        items.forEach((item) => {
            if (players.length >= limit) return;
            const name = item.querySelector('h2 a')?.innerText.trim();
            const img = item.querySelector('img');
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
    // puppeteer.launch mit --no-sandbox ist auf GitHub Actions zwingend
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const targets = [
        { url: 'https://procrosshairs.com/', game: 'CS2' },
        { url: 'https://procrosshairs.com/valorant', game: 'Valorant' }
    ];

    let allPresets = [];
    for (const target of targets) {
        const data = await scrapePage(browser, target.url, target.game, 30);
        allPresets = allPresets.concat(data);
    }

    await browser.close();
    fs.writeFileSync('./presets.json', JSON.stringify(allPresets, null, 2));
}

run();
