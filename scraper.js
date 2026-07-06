const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapePlayer(url) {
    console.log("Lade Seite...");
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);
    const players = [];

    // Wir iterieren über jeden Spieler-Container
    $('.container').each((i, el) => {
        const name = $(el).find('.player-name').text().trim();
        const imageUrl = $(el).find('.crosshair').attr('src');
        const code = $(el).find('.crosshair-code').attr('data-copy');

        // Nur speichern, wenn wir alle wichtigen Daten finden
        if (name && imageUrl && code) {
            players.push({ name, imageUrl, code });
        }
    });

    return players;
}

async function run() {
    try {
        console.log("Starte Scraping...");
        const players = await scrapePlayer('https://totalcsgo.com/crosshairs');
        
        if (players.length === 0) {
            console.warn("Warnung: Keine Spieler gefunden. Prüfe die CSS-Klassen!");
        } else {
            fs.writeFileSync('./presets.json', JSON.stringify(players, null, 2));
            console.log(`Erfolg! ${players.length} Spieler wurden in presets.json gespeichert.`);
        }
    } catch (err) {
        console.error("Kritischer Fehler:", err);
    }
}

run();
