const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const PRESETS_PATH = path.join(__dirname, 'presets.json');
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const httpOptions = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
};

function cleanName(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
    try {
        console.log("Starte fokussierten Share-Code Scraper...");
        const baseUrl = 'https://procrosshairs.com';
        
        let presets = { lastUpdated: "", pros: [], gamePresets: [] };
        if (fs.existsSync(PRESETS_PATH)) {
            presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
        }

        // 1. Alle Spieler-URLs von der Startseite sammeln
        const mainPage = await axios.get(baseUrl, httpOptions);
        const $ = cheerio.load(mainPage.data);
        const cs2Urls = [];

        $('a[href*="/player/"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href && !href.includes('/valorant/')) {
                const fullUrl = href.startsWith('http') ? href : baseUrl + href;
                if (!cs2Urls.includes(fullUrl) && cs2Urls.length < 40) {
                    cs2Urls.push(fullUrl);
                }
            }
        });
        console.log(`Gefundene CS2 Spieler-URLs: ${cs2Urls.length}`);

        // 2. Spielerseiten besuchen und nur den Code extrahieren
        for (const url of cs2Urls) {
            const urlChunks = url.split('/');
            const urlName = urlChunks[urlChunks.length - 1] || "Unknown";
            
            try {
                const profilePage = await axios.get(url, httpOptions);
                
                // Sucht nach dem CSGO-Share-Code im rohen HTML
                const shareCodeMatch = profilePage.data.match(/(CSGO-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5})/i);
                
                if (shareCodeMatch) {
                    const shareCode = shareCodeMatch[1];

                    let existingPro = presets.pros.find(p => cleanName(p.name) === cleanName(urlName) && p.game === "CS2");
                    
                    // Wir speichern nur den Namen, das Spiel und den Share-Code ab
                    const proData = { 
                        name: urlName, 
                        game: "CS2", 
                        share_code: shareCode 
                    };

                    if (existingPro) {
                        // Falls der Spieler existiert, überschreiben/behalten wir nur diese Basisdaten
                        existingPro.share_code = shareCode;
                        // Falls alte Einzelwerte (size, gap, etc.) in der JSON stören, 
                        // löschen wir sie hier heraus, damit das JSON sauber bleibt:
                        delete existingPro.cl_crosshairsize;
                        delete existingPro.cl_crosshairthickness;
                        delete existingPro.cl_crosshairgap;
                        delete existingPro.cl_crosshairdot;
                        delete existingPro.color;
                    } else {
                        presets.pros.push(proData);
                    }
                    console.log(`[Erfolg] ${urlName} -> Code: ${shareCode}`);
                } else {
                    console.log(`[Fehler] Kein Share-Code im HTML für ${urlName}`);
                }

                // 2 Sekunden Pause, um den Hoster nicht zu stressen
                await delay(2000);
            } catch (e) {
                console.error(`Fehler bei ${urlName}:`, e.message);
            }
        }

        // Ergebnis speichern
        presets.lastUpdated = new Date().toLocaleString('de-DE');
        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log("\nErfolgreich! presets.json wurde mit aktuellen Share-Codes aktualisiert.");

    } catch (error) {
        console.error("Kritischer Fehler im Ablauf:", error.message);
    }
}

run();
