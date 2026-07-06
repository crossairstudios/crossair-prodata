const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapePlayer(url) {
    console.log("Lade Seite...");
    try {
        const { data: html } = await axios.get(url);
        const $ = cheerio.load(html);
        const players = [];

        // Wir iterieren über jeden Spieler-Container
        $('.container').each((i, el) => {
            const name = $(el).find('.player-name').text().trim();
            const imageUrl = $(el).find('.crosshair').attr('src');
            const code = $(el).find('.crosshair-code').attr('data-copy');

            // FILTER: 
            // 1. Nur gültige Daten (name, imageUrl, code müssen vorhanden sein)
            // 2. Filtert den "Global-Header" durch Längenbegrenzung des Namens
            if (name && name.length < 30 && imageUrl && code) {
                players.push({ 
                    name: name, 
                    imageUrl: imageUrl, 
                    code: code 
                });
            }
        });

        return players;
    } catch (error) {
        console.error("Fehler beim Abrufen der Seite:", error);
        return [];
    }
}

async function run() {
    console.log("Starte Scraping...");
    const players = await scrapePlayer('https://totalcsgo.com/crosshairs');
    
    if (players.length === 0) {
        console.warn("Warnung: Keine Spieler gefunden. Prüfe die CSS-Klassen!");
    } else {
        const outputPath = './presets.json';
        fs.writeFileSync(outputPath, JSON.stringify(players, null, 2));
        console.log(`Erfolg! ${players.length} Spieler wurden in ${outputPath} gespeichert.`);
    }
}

run();
