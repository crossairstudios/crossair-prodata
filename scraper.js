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
        console.log("Starte stabilen HTML-Data-Scraper...");
        const baseUrl = 'https://procrosshairs.com';
        
        let presets = { lastUpdated: "", pros: [], gamePresets: [] };
        if (fs.existsSync(PRESETS_PATH)) {
            presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
        }

        // 1. Spieler-Links von der Hauptseite holen
        const mainPage = await axios.get(baseUrl, httpOptions);
        const $ = cheerio.load(mainPage.data);
        const playerUrls = [];

        $('a[href*="/player/"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href && !href.includes('/valorant/')) {
                const fullUrl = href.startsWith('http') ? href : baseUrl + href;
                if (!playerUrls.includes(fullUrl) && playerUrls.length < 40) {
                    playerUrls.push(fullUrl);
                }
            }
        });
        console.log(`Gefundene Spieler-Seiten: ${playerUrls.length}`);

        // 2. Jede Profilseite parsen
        for (const url of playerUrls) {
            const urlChunks = url.split('/');
            const playerSlug = urlChunks[urlChunks.length - 1] || "Unknown";
            
            try {
                const profilePage = await axios.get(url, httpOptions);
                const html = profilePage.data;

                // --- DER UNFEHLBARE REGEX-GREIFER ---
                // Sucht direkt nach den Datenfeldern im HTML-Quelltext
                const sizeMatch = html.match(/"cl_crosshairsize"\s*:\s*"?([0-9.-]+)"?/i);
                const thicknessMatch = html.match(/"cl_crosshairthickness"\s*:\s*"?([0-9.-]+)"?/i);
                const gapMatch = html.match(/"cl_crosshairgap"\s*:\s*"?([0-9.-]+)"?/i);
                const dotMatch = html.match(/"cl_crosshairdot"\s*:\s*"?([0-1]+)"?/i);
                const shareCodeMatch = html.match(/(CSGO-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5})/i);

                // Farb-RGB-Werte im HTML suchen
                const rMatch = html.match(/"cl_crosshaircolor_r"\s*:\s*"?([0-9]+)"?/i);
                const gMatch = html.match(/"cl_crosshaircolor_g"\s*:\s*"?([0-9]+)"?/i);
                const bMatch = html.match(/"cl_crosshaircolor_b"\s*:\s*"?([0-9]+)"?/i);

                // Fallback-Farbe (Grün) berechnen, falls kein RGB gefunden wird
                let colorHex = "#00ff00";
                if (rMatch && gMatch && bMatch) {
                    const toHex = (c) => String("0" + parseInt(c).toString(16)).slice(-2);
                    colorHex = `#${toHex(rMatch[1])}${toHex(gMatch[1])}${toHex(bMatch[1])}`;
                }

                // Werte extrahieren oder Standardwerte setzen
                const size = sizeMatch ? parseFloat(sizeMatch[1]) : 2;
                const thickness = thicknessMatch ? parseFloat(thicknessMatch[1]) : 1;
                const gap = gapMatch ? parseFloat(gapMatch[1]) : -2;
                const dot = dotMatch ? parseInt(dotMatch[1]) : 0;
                const shareCode = shareCodeMatch ? shareCodeMatch[1] : "";

                let existingPro = presets.pros.find(p => cleanName(p.name) === cleanName(playerSlug) && p.game === "CS2");
                const finalData = {
                    name: playerSlug,
                    game: "CS2",
                    cl_crosshairsize: size,
                    cl_crosshairthickness: thickness,
                    cl_crosshairgap: gap,
                    cl_crosshairdot: dot,
                    color: colorHex,
                    share_code: shareCode
                };

                if (existingPro) {
                    Object.assign(existingPro, finalData);
                } else {
                    presets.pros.push(finalData);
                }

                console.log(`[Erfolg] ${playerSlug} -> Gap: ${gap} | Size: ${size} | Color: ${colorHex}`);
                
                await delay(1500); // 1.5 Sek Pause
            } catch (e) {
                console.error(`[Fehler] Konnte Profil von ${playerSlug} nicht auslesen:`, e.message);
            }
        }

        presets.lastUpdated = new Date().toLocaleString('de-DE');
        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log("\nScraping erfolgreich beendet! presets.json ist befüllt.");

    } catch (error) {
        console.error("Kritischer Fehler im Hauptablauf:", error.message);
    }
}

run();
