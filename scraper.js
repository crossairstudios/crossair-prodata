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

        $('li[role="button"]').each((i, el) => {
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

    // Wir definieren alle Ziel-URLs
    const targets = [
        { url: 'https://procrosshairs.com/', game: 'CS2' },
        { url: 'https://procrosshairs.com/valorant', game: 'Valorant' }
    ];

    let allPresets = [];

    // Wir sammeln nacheinander Daten in allPresets
    for (const target of targets) {
        const data = await scrapePage(target.url, target.game, 30);
        console.log(`Gefunden für ${target.game}: ${data.length}`);
        allPresets = allPresets.concat(data);
    }

    // Erst hier schreiben wir die Datei, nachdem ALLE Daten gesammelt wurden
    const outputPath = './presets.json';
    fs.writeFileSync(outputPath, JSON.stringify(allPresets, null, 2));
    console.log(`Erfolg! Insgesamt ${allPresets.length} Presets gespeichert.`);
}

run();
