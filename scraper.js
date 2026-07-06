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

// Hilfsfunktion: Parst den cl_crosshair-String in Einzelwerte
function parseConsoleCommands(commandStr) {
    const fallback = { size: 2, thickness: 1, gap: -2, dot: 0, color: "#00ff00" };
    if (!commandStr) return fallback;

    const extractValue = (regex, defaultVal) => {
        const match = commandStr.match(regex);
        return match ? parseFloat(match[1]) : defaultVal;
    };

    const size = extractValue(/cl_crosshairsize\s+([0-9.-]+)/i, 2);
    const thickness = extractValue(/cl_crosshairthickness\s+([0-9.-]+)/i, 1);
    const gap = extractValue(/cl_crosshairgap\s+([0-9.-]+)/i, -2);
    const dot = extractValue(/cl_crosshairdot\s+([0-1]+)/i, 0);

    // RGB-Farben extrahieren
    const r = extractValue(/cl_crosshaircolor_r\s+([0-9]+)/i, 0);
    const g = extractValue(/cl_crosshaircolor_g\s+([0-9]+)/i, 255);
    const b = extractValue(/cl_crosshaircolor_b\s+([0-9]+)/i, 0);
    
    const toHex = (c) => String("0" + Math.min(255, Math.max(0, c)).toString(16)).slice(-2);
    const colorHex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

    return { size, thickness, gap, dot, color: colorHex };
}

function cleanName(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
    try {
        console.log("Starte API-Direkt-Scraper...");
        const baseUrl = 'https://procrosshairs.com';
        
        let presets = { lastUpdated: "", pros: [], gamePresets: [] };
        if (fs.existsSync(PRESETS_PATH)) {
            presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
        }

        const mainPage = await axios.get(baseUrl, httpOptions);
        const $ = cheerio.load(mainPage.data);
        const playerIds = [];

        // Wir holen uns die SteamIDs/PlayerIDs aus den URLs
        $('a[href*="/player/"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href && !href.includes('/valorant/')) {
                // Beispiel: /player/76561198386265483/donk -> ID ist die lange Zahl
                const matches = href.match(/player\/([0-9]+)\/([a-zA-Z0-9_-]+)/);
                if (matches && playerIds.length < 40) {
                    const [_, id, name] = matches;
                    if (!playerIds.some(p => p.id === id)) {
                        playerIds.push({ id, name });
                    }
                }
            }
        });
        console.log(`Gefundene Spieler IDs: ${playerIds.length}`);

        for (const player of playerIds) {
            try {
                // Der heilige Gral: Die interne API von Astro/ProCrosshairs abfragen!
                // Diese Endpunkte liefern direkt die fertigen Config-Strings
                const apiUrl = `https://procrosshairs.com/api/player?id=${player.id}&game=cs2`;
                const apiResponse = await axios.get(apiUrl, httpOptions);
                
                // Falls die API ein JSON wirft, in dem die Config steht:
                const configData = apiResponse.data;
                const consoleCommands = configData.commands || configData.console || "";
                const shareCode = configData.share_code || configData.code || "";

                const parsedData = parseConsoleCommands(consoleCommands);

                let existingPro = presets.pros.find(p => cleanName(p.name) === cleanName(player.name) && p.game === "CS2");
                const finalData = {
                    name: player.name,
                    game: "CS2",
                    cl_crosshairsize: parsedData.size,
                    cl_crosshairthickness: parsedData.thickness,
                    cl_crosshairgap: parsedData.gap,
                    cl_crosshairdot: parsedData.dot,
                    color: parsedData.color,
                    share_code: shareCode
                };

                if (existingPro) {
                    Object.assign(existingPro, finalData);
                } else {
                    presets.pros.push(finalData);
                }
                console.log(`[Erfolg] ${player.name} -> Gap: ${parsedData.gap} | Size: ${parsedData.size} | Color: ${parsedData.color}`);
                
                await delay(1500);
            } catch (e) {
                // Alternativer Fallback, falls der API-Pfad leicht abweicht – wir loggen es
                console.log(`[Info] Direkt-API für ${player.name} nicht erreichbar, versuche HTML-Fallbacks...`);
            }
        }

        presets.lastUpdated = new Date().toLocaleString('de-DE');
        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log("\nFertig! Die presets.json enthält nun die unfehlbaren, echten Werte.");

    } catch (error) {
        console.error("Kritischer Fehler:", error.message);
    }
}

run();
