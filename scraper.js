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

// Regex-Parser für Valorant Konsolen-Strings
function parseValorantConfig(configStr) {
    const lengthMatch = configStr.match(/0l;([0-9.-]+)/);
    const thicknessMatch = configStr.match(/0t;([0-9.-]+)/);
    const gapMatch = configStr.match(/0o;([0-9.-]+)/);
    const dotMatch = configStr.match(/d;([0-1])/);
    const colorIdMatch = configStr.match(/c;([0-9]+)/);

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
        
        const cs2Urls = [];
        const valUrls = [];

        // 1. Links für die ersten 20 CS2 Profis sammeln
        console.log("Lese CS2 Übersichtsseite ein...");
        const htmlCS2 = await axios.get(baseUrl);
        let $ = cheerio.load(htmlCS2.data);
        $('a[href*="/player/cs2/"]').each((i, el) => {
            if (cs2Urls.length < 20) {
                const href = $(el).attr('href');
                const fullUrl = href.startsWith('http') ? href : baseUrl + href;
                if (!cs2Urls.includes(fullUrl)) cs2Urls.push(fullUrl);
            }
        });

        // 2. Links für die ersten 20 Valorant Profis sammeln
        console.log("Lese Valorant Übersichtsseite ein...");
        const htmlVal = await axios.get(`${baseUrl}/valorant`);
        $ = cheerio.load(htmlVal.data);
        $('a[href*="/player/valorant/"]').each((i, el) => {
            if (valUrls.length < 20) {
                const href = $(el).attr('href');
                const fullUrl = href.startsWith('http') ? href : baseUrl + href;
                if (!valUrls.includes(fullUrl)) valUrls.push(fullUrl);
            }
        });

        console.log(`Gefunden: ${cs2Urls.length} CS2 Profile und ${valUrls.length} Valorant Profile.`);

        // 3. Bestehende presets.json laden
        let presets = { lastUpdated: "", pros: [], gamePresets: [] };
        if (fs.existsSync(PRESETS_PATH)) {
            presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
        }

        // Hilfsliste, um alle aktuell verarbeiteten Spieler-Namen im Auge zu behalten
        const activeScrapedNames = [];

        // 4. CS2 Profile nacheinander abfragen
        for (const url of cs2Urls) {
            try {
                const urlName = url.split('/').pop();
                console.log(`Verarbeite CS2 Profil von: ${urlName}`);
                
                const profilePage = await axios.get(url);
                const $p = cheerio.load(profilePage.data);
                
                const shareCode = $p('input, textarea').eq(0).val() || "";
                const consoleString = $p('input, textarea').eq(1).val() || "";

                if (shareCode) {
                    const parsedData = parseCS2Config(consoleString);
                    const displayName = urlName.charAt(0).toUpperCase() + urlName.slice(1);
                    activeScrapedNames.push(displayName.toLowerCase());

                    // CASE-INSENSITIVE ABGLEICH: Findet "NiKo" unabhängig von "niko"
                    let existingPro = presets.pros.find(p => p.name.toLowerCase() === displayName.toLowerCase() && p.game === "CS2");

                    if (existingPro) {
                        // Aktualisiere Werte, behalte aber das exakte Namens-Casing aus der JSON
                        Object.assign(existingPro, parsedData);
                        existingPro.share_code = shareCode;
                    } else {
                        // Neu hinzufügen, falls noch nicht im System
                        presets.pros.push({
                            name: displayName,
                            game: "CS2",
                            ...parsedData,
                            share_code: shareCode
                        });
                    }
                }
                await delay(5000); // Fair-Use 5 Sekunden Zwangspause
            } catch (err) {
                console.error(`Fehler bei CS2 URL ${url}:`, err.message);
            }
        }

        // 5. Valorant Profile nacheinander abfragen
        for (const url of valUrls) {
            try {
                const urlName = url.split('/').pop();
                console.log(`Verarbeite Valorant Profil von: ${urlName}`);
                
                const profilePage = await axios.get(url);
                const $p = cheerio.load(profilePage.data);
                
                const shareCode = $p('input, textarea').eq(0).val() || "";
                const consoleString = $p('input, textarea').eq(1).val() || "";

                if (shareCode) {
                    const parsedData = parseValorantConfig(consoleString);
                    const displayName = urlName.charAt(0).toUpperCase() + urlName.slice(1);
                    activeScrapedNames.push(displayName.toLowerCase());

                    // CASE-INSENSITIVE ABGLEICH
                    let existingPro = presets.pros.find(p => p.name.toLowerCase() === displayName.toLowerCase() && p.game === "Valorant");

                    if (existingPro) {
                        Object.assign(existingPro, parsedData);
                        existingPro.share_code = shareCode;
                    } else {
                        presets.pros.push({
                            name: displayName,
                            game: "Valorant",
                            ...parsedData,
                            share_code: shareCode
                        });
                    }
                }
                await delay(5000); // Fair-Use 5 Sekunden Zwangspause
            } catch (err) {
                console.error(`Fehler bei Valorant URL ${url}:`, err.message);
            }
        }

        // 6. JSON speichern und verifizieren
        presets.lastUpdated = new Date().toLocaleDateString('de-DE');
        
        // Formatiert speichern (2er-Einrückung)
        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log(`Scraping beendet! presets.json erfolgreich aktualisiert am ${presets.lastUpdated}.`);

    } catch (error) {
        console.error("Kritischer globaler Fehler im Scraper:", error);
    }
}

run();
