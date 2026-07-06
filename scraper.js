// scraper.js - Schnipsel für die Extraktion
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapePlayer(url) {
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);
    
    // Bestehende Werte extrahieren...
    const name = $('.player-name').text();
    const size = parseFloat($('[data-size]').attr('data-size'));
    
    // NEU: Bild-URL extrahieren
    const imageUrl = $('img[src*="static.totalcsgo.com"]').attr('src') || null;

    return { name, size, imageUrl /* ... weitere Werte */ };
}

// Speichern als presets.json
async function run() {
    const players = await scrapePlayer('https://totalcsgo.com/crosshairs');
    fs.writeFileSync('presets.json', JSON.stringify(players, null, 2));
}
run();
