const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapePlayer(url) {
    console.log("Lade Seite:", url);
    try {
        // Procrosshairs nutzt teilweise dynamisches Rendering. 
        // Falls axios allein nicht reicht, müsste man später auf Playwright/Puppeteer umsteigen.
        // Für den Anfang versuchen wir es mit axios + cheerio:
        const { data: html } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' } // Wichtig, um nicht blockiert zu werden
        });
        const $ = cheerio.load(html);
        const players = [];

        // Wir iterieren über die <li>-Elemente, die wir analysiert haben
        $('li[role="button"]').each((i, el) => {
            const name = $(el).find('h2 a').text().trim();
            const imageUrl = $(el).find('img').attr('src');
            
            // Code aus dem alt-Attribut ziehen
            const altText = $(el).find('img').attr('alt') || "";
            const code = altText.split(': ')[1] || "";

            if (name && imageUrl && code) {
                players.push({ 
                    name: name, 
                    imageUrl: imageUrl, 
                    code: code,
                    game: "CS2"
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
    console.log("Starte Scraping für ProCrosshairs...");
    // Hier kannst du die URL jetzt einfach anpassen
    const players = await scrapePlayer('https://procrosshairs.com/');
    
    if (players.length === 0) {
        console.warn("Warnung: Keine Spieler gefunden. Prüfe die Selektoren oder die Seite.");
    } else {
        const outputPath = './presets.json';
        fs.writeFileSync(outputPath, JSON.stringify(players, null, 2));
        console.log(`Erfolg! ${players.length} Presets wurden in ${outputPath} gespeichert.`);
    }
}

run();
