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

function rgbToHex(r, g, b) {
    if (r === undefined || g === undefined || b === undefined || isNaN(r) || isNaN(g) || isNaN(b)) {
        return "#00ff00";
    }
    const toHex = (c) => {
        const hex = Math.max(0, Math.min(255, parseInt(c))).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function parseCS2Commands(commandsStr) {
    // Standard-Fallbacks falls etwas fehlt
    const result = {
        cl_crosshairsize: 2,
        cl_crosshairthickness: 1,
        cl_crosshairgap: -2,
        cl_crosshairdot: 0,
        color: "#00ff00"
    };

    if (!commandsStr) return result;

    // Wir zerlegen den String bei jedem Semikolon
    const parts = commandsStr.split(';');
    let r = 0, g = 255, b = 0; // Standard Grün-Werte vorab

    parts.forEach(part => {
        const clean = part.trim();
        // Matcht den Befehl und den Wert (auch negative Zahlen und Booleans)
        const match = clean.match(/^([a-zA-Z0-9_]+)\s+(.+)$/);
        
        if (match) {
            const command = match[1].toLowerCase();
            const value = match[2].toLowerCase();

            if (command === 'cl_crosshairsize') result.cl_crosshairsize = parseFloat(value);
            if (command === 'cl_crosshairthickness') result.cl_crosshairthickness = parseFloat(value);
            if (command === 'cl_crosshairgap') result.cl_crosshairgap = parseFloat(value);
            
            if (command === 'cl_crosshairdot') {
                result.cl_crosshairdot = (value === 'true' || value === '1') ? 1 : 0;
            }

            if (command === 'cl_crosshaircolor_r') r = parseInt(value);
            if (command === 'cl_crosshaircolor_g') g = parseInt(value);
            if (command === 'cl_crosshaircolor_b') b = parseInt(value);
        }
    });

    result.color = rgbToHex(r, g, b);
    return result;
}

function cleanName(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
    try {
        console.log("Starte zielgerichteten Astro-HTML-Scraper...");
        const baseUrl = 'https://procrosshairs.com';
        
        let presets = { lastUpdated: "", pros: [], gamePresets: [] };
        if (fs.existsSync(PRESETS_PATH)) {
            presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
        }

        // 1. Links von der Hauptseite einsammeln
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

        // 2. Jede Spielerseite einzeln abgrasen
        for (const url of cs2Urls) {
            const urlChunks = url.split('/');
            const urlName = urlChunks[urlChunks.length - 1] || "Unknown";
            
            console.log(`Scrape Spieler: ${urlName}...`);
            try {
                const profilePage = await axios.get(url, httpOptions);
                const $p = cheerio.load(profilePage.data);

                // Wir suchen nach dem Input-Feld, das die cl_crosshair-Befehle im Value hält
                let consoleCommands = "";
                $p('input[value*="cl_crosshair"]').each((i, el) => {
                    consoleCommands = $p(el).attr('value') || "";
                });

                // Den Share-Code (CSGO-XXXXX) fischen wir parallel aus dem rohen HTML
                const shareCodeMatch = profilePage.data.match(/(CSGO-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5})/i);
                
                if (shareCodeMatch && consoleCommands) {
                    const shareCode = shareCodeMatch[1];
                    const parsedData = parseCS2Commands(consoleCommands);

                    let existingPro = presets.pros.find(p => cleanName(p.name) === cleanName(urlName) && p.game === "CS2");
                    if (existingPro) {
                        Object.assign(existingPro, parsedData, { share_code: shareCode });
                        console.log(`   -> OK! Gap: ${existingPro.cl_crosshairgap}, Size: ${existingPro.cl_crosshairsize}, Color: ${existingPro.color}`);
                    } else {
                        presets.pros.push({ name: urlName, game: "CS2", ...parsedData, share_code: shareCode });
                        console.log(`   -> Neu angelegt! Gap: ${parsedData.cl_crosshairgap}`);
                    }
                } else {
                    console.log(`   -> Fehler: Konsolenbefehle oder Share-Code nicht auslesbar.`);
                }

                await delay(2000);
            } catch (e) {
                console.error(`Fehler bei ${urlName}:`, e.message);
            }
        }

        // Speichern der Datei
        presets.lastUpdated = new Date().toLocaleString('de-DE');
        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log("\nErfolgreich beendet! presets.json hat jetzt die echten Individual-Werte.");

    } catch (error) {
        console.error("Kritischer Fehler im Ablauf:", error.message);
    }
}

run();
