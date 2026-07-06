const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapePlayer(url) {
    console.log("Lade Seite...");
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);
    
    // Wir sammeln die Daten hier
    const players = [];

    // HINWEIS: Hier müssen die Selektoren rein, die zu der Struktur von totalcsgo.com passen
    // Falls sich das Design geändert hat, ist das der Punkt, den wir anpassen müssen.
    $('.crosshair-card').each((i, el) => {
        const name = $(el).find('.player-name').text().trim();
        const imageUrl = $(el).find('img').attr('src');
        
        // Beispiel für die Werte (müssen auf die Klassen der Website angepasst werden)
        const size = $(el).attr('data-size'); 

        players.push({ name, imageUrl, size });
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
            console.log(`Erfolg! ${players.length} Spieler gespeichert.`);
        }
    } catch (err) {
        console.error("Kritischer Fehler:", err);
    }
}

run();
