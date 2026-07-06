const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapePage(url, gameName, limit = 30) {
    console.log(`Lade ${gameName} von: ${url}`);
    try {
        const { data: html } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(html);
        const players = [];

        // Wir iterieren über die Kacheln
        $('li[role="button"]').each((i, el) => {
            // Stoppe, wenn wir das Limit erreicht haben
            if (players.length >= limit) return false;

            const name = $(el).find('h2 a').text().trim();
            const imageUrl = $(el).find('img').attr('src');
            const altText = $(el).find('img').attr('alt') || "";
            const code = altText.split(': ')[1] || "";

            if (name && imageUrl && code) {
                players.push({ 
                    name, 
                    imageUrl, 
                    code,
                    game: gameName
                });
            }
        });

        return players;
    } catch (error) {
        console.error(`Fehler bei ${gameName}:`, error);
        return [];
    }
}

async function run() {
    console.log("Starte Multi-Game Scraping...");

    const targets = [
        { url: 'https://procrosshairs.com/', game: 'CS2' },
        { url: 'https://procrosshairs.com/valorant', game: 'Valorant' }
    ];

    let allPresets = [];

    for (const target of targets) {
        const data = await scrapePage(target.url, target.game, 30);
        allPresets = allPresets.concat(data);
    }

    const outputPath = './presets.json';
    fs.writeFileSync(outputPath, JSON.stringify(allPresets, null, 2));
    console.log(`Erfolg! Insgesamt ${allPresets.length} Presets in ${outputPath} gespeichert.`);
}

run();
