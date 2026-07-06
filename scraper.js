const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const PRESETS_PATH = path.join(__dirname, 'presets.json');

// Hilfsfunktion für die Zwangspause (Fair-Use)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Funktion zur Umrechnung von RGB in HEX
function rgbToHex(r, g, b) {
    if (r === undefined || g === undefined || b === undefined) return "#00ff00"; // Standard-Grün als Fallback
    const toHex = (c) => {
        const hex = Math.max(0, Math.min(255, parseInt(c))).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Regex-Parser für CS2 Konsolen-Strings
function parseCS2Config(configStr) {
    const sizeMatch = configStr.match(/cl_crosshairsize\s+([0-9.-]+)/);
    const thicknessMatch = configStr.match(/cl_crosshairthickness\s+([0-9.-]+)/);
    const gapMatch = configStr.match(/cl_crosshairgap\s+([0-9.-]+)/);
    const dotMatch = configStr.match(/cl_crosshairdot\s+([0-1])/);
    
    const rMatch = configStr.match(/cl_crosshaircolor_r\s+([0-9]+)/);
    const gMatch = configStr.match(/cl_crosshaircolor_g\s+([0-9]+)/);
    const bMatch = configStr.match(/cl_crosshaircolor_b\s+([0-9]+)/);

    return {
        cl_crosshairsize: sizeMatch ? parseFloat(sizeMatch[1]) : 2,
        cl_crosshairthickness: thicknessMatch ? parseFloat(thicknessMatch[1]) : 1,
        cl_crosshairgap: gapMatch ? parseFloat(gapMatch[1]) : -2,
        cl_crosshairdot: dotMatch ? parseInt(dotMatch[1]) : 0,
        color: rgbToHex(rMatch?.[1], gMatch?.[1], bMatch?.[1])
    };
}

// Regex-Parser für Valorant Konsolen-Strings (Profil-Strings)
function parseValorantConfig(configStr) {
    const lengthMatch = configStr.match(/0l;([0-9.-]+)/);
    const thicknessMatch = configStr.match(/0t;([0-9.-]+)/);
    const gapMatch = configStr.match(/0o;([0-9.-]+)/);
    const dotMatch = configStr.match(/d;([0-1])/);
    const colorIdMatch = configStr.match(/c;([0-9]+)/);

    // Grobe Farbzuordnung für Valorant Standardfarben (0=Weiß, 1=Grün, 2=Gelbgrün, 3=Grüngelb, 4=Gelb, 5=Cyan, 6=Pink, 7=Rot)
    const colorMap = { "0": "#ffffff", "1": "#00ff00", "4": "#ffff00", "5": "#00ffff", "6": "#ff00ff", "7": "#ff0000" };
    const colorHex = colorIdMatch ? (colorMap[colorIdMatch[1]] || "#00ff00") : "#00ff00";

    return {
        inner_length: lengthMatch ? parseFloat(lengthMatch[1]) : 4,
        inner_thickness: thicknessMatch ? parseFloat(thicknessMatch[1]) : 2,
        inner_gap: gapMatch ? parseFloat(gapMatch[1]) : 2,
        show_dot: dotMatch ? dotMatch[1] === "1" : false,
        color: colorHex
    };
}

async function run() {
    try {
        console.log("Starte Fadenkreuz-Scraper...");
        const baseUrl = 'https://procrosshairs.com';
        
        // 1. URLs holen
        const cs2Urls = [];
        const valUrls = [];

        // CS2 Hauptseite laden
        const htmlCS2 = await axios.get(baseUrl);
        let $ = cheerio.load(htmlCS2.data);
        $('a[href*="/player/cs2/"]').each((i, el) => {
            if (cs2Urls.length < 20) {
                const href = $(el).attr('href');
                if (!cs2Urls.includes(baseUrl + href)) cs2Urls.push(baseUrl + href);
            }
        });

        // Valorant Unterseite laden
        const htmlVal = await axios.get(`${baseUrl}/valorant`);
        $ = cheerio.load(htmlVal.data);
        $('a[href*="/player/valorant/"]').each((i, el) => {
            if (valUrls.length < 20) {
                const href = $(el).attr('href');
                if (!valUrls.includes(baseUrl + href)) valUrls.push(baseUrl + href);
            }
        });

        console.log(`Gefunden: ${cs2Urls.length} CS2 Profile und ${valUrls.length} Valorant Profile.`);

        // 2. Bestehende Presets laden
        let presets = { lastUpdated: "", pros: [], gamePresets: [] };
        if (fs.existsSync(PRESETS_PATH)) {
            presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
        }

        const updatedPros = [];

        // 3. CS2 Profile abfragen
        for (const url of cs2Urls) {
            try {
                console.log(`Lade CS2 Profil: ${url}`);
                const profilePage = await axios.get(url);
                const $p = cheerio.load(profilePage.data);
                
                const name = url.split('/').pop();
                // Holt die Werte aus den beiden Input-Feldern/Copy-Containern der Seite
                const shareCode = $p('input, textarea').eq(0).val() || "";
                const consoleString = $p('input, textarea').eq(1).val() || "";

                if (shareCode.startsWith("CSGO-")) {
                    const parsedData = parseCS2Config(consoleString);
                    updatedPros.push({
                        name: name.charAt(0).toUpperCase() + name.slice(1),
                        game: "CS2",
                        ...parsedData,
                        share_code: shareCode
                    });
                }
                await delay(5000); // 5 Sekunden Pause
            } catch (err) {
                console.error(`Fehler bei URL ${url}:`, err.message);
            }
        }

        // 4. Valorant Profile abfragen
        for (const url of valUrls) {
            try {
                console.log(`Lade Valorant Profil: ${url}`);
                const profilePage = await axios.get(url);
                const $p = cheerio.load(profilePage.data);
                
                const name = url.split('/').pop();
                const shareCode = $p('input, textarea').eq(0).val() || "";
                const consoleString = $p('input, textarea').eq(1).val() || "";

                if (shareCode) {
                    const parsedData = parseValorantConfig(consoleString);
                    updatedPros.push({
                        name: name.charAt(0).toUpperCase() + name.slice(1),
                        game: "Valorant",
                        ...parsedData,
                        share_code: shareCode
                    });
                }
                await delay(5000); // 5 Sekunden Pause
            } catch (err) {
                console.error(`Fehler bei URL ${url}:`, err.message);
            }
        }

        // 5. Presets-Datei aktualisieren
        if (updatedPros.length > 0) {
            presets.pros = updatedPros;
            presets.lastUpdated = new Date().toLocaleDateString('de-DE');
            fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
            console.log("presets.json erfolgreich aktualisiert!");
        }

    } catch (error) {
        console.error("Globaler Scraper-Fehler:", error);
    }
}

run();
