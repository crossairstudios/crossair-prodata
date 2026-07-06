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
        console.log("Starte TotalCSGO-Scraper (bereinigt)...");
        const mainUrl = 'https://totalcsgo.com/crosshairs';
        
        let presets = { lastUpdated: "", pros: [], gamePresets: [] };
        if (fs.existsSync(PRESETS_PATH)) {
            presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
        }

        // 1. Hauptseite laden
        const mainPage = await axios.get(mainUrl, httpOptions);
        const $ = cheerio.load(mainPage.data);
        const playerUrls = [];

        $('a[href*="/crosshairs/"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href) {
                const fullUrl = href.startsWith('http') ? href : 'https://totalcsgo.com' + href;
                const urlChunks = fullUrl.split('/');
                const playerSlug = urlChunks[urlChunks.length - 1] || "";

                // FILTER: Keine Duplikate, nicht die Hauptseite UND nicht den Generator mitnehmen!
                if (
                    !playerUrls.includes(fullUrl) && 
                    fullUrl !== 'https://totalcsgo.com/crosshairs' && 
                    playerSlug.toLowerCase() !== 'generator' && 
                    playerUrls.length < 40
                ) {
                    playerUrls.push(fullUrl);
                }
            }
        });

        console.log(`Gefundene echte Spieler auf TotalCSGO: ${playerUrls.length}`);

        // 2. Spieler-Unterseiten abklappern
        for (const url of playerUrls) {
            const urlChunks = url.split('/');
            const playerSlug = urlChunks[urlChunks.length - 1] || "Unknown";
            
            try {
                const profilePage = await axios.get(url, httpOptions);
                const html = profilePage.data;

                // Share-Code extrahieren
                const shareCodeMatch = html.match(/(CSGO-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5})/i);
                const shareCode = shareCodeMatch ? shareCodeMatch[1] : "";

                // Einzelwerte via Regex parsen
                const extractValue = (regex, defaultVal) => {
                    const match = html.match(regex);
                    return match ? parseFloat(match[1]) : defaultVal;
                };

                const size = extractValue(/cl_crosshairsize\s+["']?([0-9.-]+)["']?/i, 2);
                const thickness = extractValue(/cl_crosshairthickness\s+["']?([0-9.-]+)["']?/i, 1);
                const gap = extractValue(/cl_crosshairgap\s+["']?([0-9.-]+)["']?/i, -2);
                const dot = extractValue(/cl_crosshairdot\s+["']?([0-1]+)["']?/i, 0);

                // RGB Farben extrahieren
                const r = extractValue(/cl_crosshaircolor_r\s+([0-9]+)/i, 0);
                const g = extractValue(/cl_crosshaircolor_g\s+([0-9]+)/i, 255);
                const b = extractValue(/cl_crosshaircolor_b\s+([0-9]+)/i, 0);
                
                const toHex = (c) => String("0" + Math.min(255, Math.max(0, c)).toString(16)).slice(-2);
                const colorHex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

                let existingPro = presets.pros.find(p => cleanName(p.name) === cleanName(playerSlug) && p.game === "CS2");
                const finalData = {
                    name: playerSlug.charAt(0).toUpperCase() + playerSlug.slice(1),
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

                console.log(`[Erfolg] ${finalData.name} -> Gap: ${gap} | Size: ${size} | Color: ${colorHex}`);
                
                await delay(1500);
            } catch (e) {
                console.error(`[Fehler] Konnte ${playerSlug} nicht parsen:`, e.message);
            }
        }

        // Speichern
        presets.lastUpdated = new Date().toLocaleString('de-DE');
        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log("\nAbsolut perfekt! presets.json wurde ohne Generator-Eintrag aktualisiert.");

    } catch (error) {
        console.error("Kritischer Fehler im Scraper:", error.message);
    }
}

run();
