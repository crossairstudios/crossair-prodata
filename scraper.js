const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const PRESETS_PATH = path.join(__dirname, 'presets.json');

const httpOptions = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
};

function rgbToHex(r, g, b) {
    // Falls Werte ungültig oder NaN sind, direkt Standard-Grün zurückgeben
    if (r === undefined || g === undefined || b === undefined || isNaN(r) || isNaN(g) || isNaN(b)) {
        return "#00ff00";
    }
    const toHex = (c) => {
        const hex = Math.max(0, Math.min(255, parseInt(c))).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function parseBooleanOrNumber(val) {
    if (!val) return 0;
    const clean = String(val).trim().toLowerCase();
    return (clean === 'true' || clean === '1') ? 1 : 0;
}

function parseCS2Config(configStr) {
    if (!configStr || typeof configStr !== 'string') {
        return { cl_crosshairsize: 2, cl_crosshairthickness: 1, cl_crosshairgap: -2, cl_crosshairdot: 0, color: "#00ff00" };
    }

    const sizeMatch = configStr.match(/cl_crosshairsize\s+([0-9.-]+)/i);
    const thicknessMatch = configStr.match(/cl_crosshairthickness\s+([0-9.-]+)/i);
    const gapMatch = configStr.match(/cl_crosshairgap\s+([0-9.-]+)/i);
    const dotMatch = configStr.match(/cl_crosshairdot\s+([0-9.-]+)/i);
    
    const rMatch = configStr.match(/cl_crosshaircolor_r\s+([0-9]+)/i);
    const gMatch = configStr.match(/cl_crosshaircolor_b\s+([0-9]+)/i); // Vorsichtshalber b/g Toleranz
    const bMatch = configStr.match(/cl_crosshaircolor_g\s+([0-9]+)/i);

    const r = rMatch ? parseInt(rMatch[1]) : undefined;
    const g = gMatch ? parseInt(gMatch[1]) : undefined;
    const b = bMatch ? parseInt(bMatch[1]) : undefined;

    return {
        cl_crosshairsize: sizeMatch ? parseFloat(sizeMatch[1]) : 2,
        cl_crosshairthickness: thicknessMatch ? parseFloat(thicknessMatch[1]) : 1,
        cl_crosshairgap: gapMatch ? parseFloat(gapMatch[1]) : -2,
        cl_crosshairdot: dotMatch ? parseBooleanOrNumber(dotMatch[1]) : 0,
        color: rgbToHex(r, g, b)
    };
}

function parseValorantConfig(configStr) {
    if (!configStr || typeof configStr !== 'string') {
        return { inner_length: 4, inner_thickness: 2, inner_gap: 2, show_dot: false, color: "#00ff00" };
    }
    
    const lengthMatch = configStr.match(/0l;([0-9.-]+)/);
    const thicknessMatch = configStr.match(/0t;([0-9.-]+)/);
    const gapMatch = configStr.match(/0o;([0-9.-]+)/);
    const dotMatch = configStr.match(/d;([0-1]|true|false)/);
    const colorIdMatch = configStr.match(/c;([0-9]+)/);

    const colorMap = { "0": "#ffffff", "1": "#00ff00", "4": "#ffff00", "5": "#00ffff", "6": "#ff00ff", "7": "#ff0000" };
    const colorHex = colorIdMatch ? (colorMap[colorIdMatch[1]] || "#00ff00") : "#00ff00";

    return {
        inner_length: lengthMatch ? parseFloat(lengthMatch[1]) : 4,
        inner_thickness: thicknessMatch ? parseFloat(thicknessMatch[1]) : 2,
        inner_gap: gapMatch ? parseFloat(gapMatch[1]) : 2,
        show_dot: dotMatch ? (dotMatch[1] === "1" || dotMatch[1] === "true") : false,
        color: colorHex
    };
}

function cleanName(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
    try {
        console.log("Starte All-in-One PopUp-Massen-Scraper V2...");
        const baseUrl = 'https://procrosshairs.com';
        
        let presets = { lastUpdated: "", pros: [], gamePresets: [] };
        if (fs.existsSync(PRESETS_PATH)) {
            presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
        }

        // --- 1. CS2 DATEN EXTRAHIEREN ---
        console.log("Lade CS2 Hauptseite...");
        const responseCS2 = await axios.get(baseUrl, httpOptions);
        const $cs2 = cheerio.load(responseCS2.data);
        
        const nextDataCS2Text = $cs2('#__NEXT_DATA__').html();
        if (nextDataCS2Text) {
            const nextData = JSON.parse(nextDataCS2Text);
            const pageProps = nextData.props?.pageProps || {};
            
            // Sucht nach Arrays im JSON, um die Spielerliste aufzuspüren
            const playersList = pageProps.players || pageProps.initialPlayers || Object.values(pageProps).find(val => Array.isArray(val)) || [];
            console.log(`Gefundene CS2-Rohdaten im Speicher: ${playersList.length} Einträge.`);
            
            const cs2Selection = playersList.slice(0, 40);
            for (const p of cs2Selection) {
                if (!p) continue;
                const name = p.name || p.slug || p.playerName || "Unknown";
                const shareCode = p.crosshair_code || p.code || p.shareCode || p.share_code || "";
                
                // Wir durchsuchen das Objekt flexibel nach Texten, die CS2 Befehle enthalten könnten
                let consoleCommands = "";
                if (p.console_commands) consoleCommands = p.console_commands;
                else if (p.commands) consoleCommands = p.commands;
                else if (p.settings && typeof p.settings === 'string') consoleCommands = p.settings;
                else {
                    // Fallback: Das Objekt komplett als String durchsuchen, falls verschachtelt
                    consoleCommands = JSON.stringify(p);
                }
                
                if (shareCode) {
                    const parsedData = parseCS2Config(consoleCommands);
                    
                    // Falls die Properties flach auf dem Objekt liegen, überschreiben wir den Parser mit Direktwerten
                    if (p.cl_crosshairsize !== undefined) parsedData.cl_crosshairsize = parseFloat(p.cl_crosshairsize);
                    if (p.cl_crosshairthickness !== undefined) parsedData.cl_crosshairthickness = parseFloat(p.cl_crosshairthickness);
                    if (p.cl_crosshairgap !== undefined) parsedData.cl_crosshairgap = parseFloat(p.cl_crosshairgap);
                    if (p.cl_crosshairdot !== undefined) parsedData.cl_crosshairdot = parseBooleanOrNumber(p.cl_crosshairdot);

                    let existingPro = presets.pros.find(ex => cleanName(ex.name) === cleanName(name) && ex.game === "CS2");
                    if (existingPro) {
                        Object.assign(existingPro, parsedData, { share_code: shareCode });
                    } else {
                        presets.pros.push({ name, game: "CS2", ...parsedData, share_code: shareCode });
                    }
                }
            }
        }

        // --- 2. VALORANT DATEN EXTRAHIEREN ---
        console.log("\nLade Valorant Hauptseite...");
        const responseVal = await axios.get(`${baseUrl}/valorant`, httpOptions);
        const $val = cheerio.load(responseVal.data);
        
        const nextDataValText = $val('#__NEXT_DATA__').html();
        if (nextDataValText) {
            const nextData = JSON.parse(nextDataValText);
            const pageProps = nextData.props?.pageProps || {};
            const playersList = pageProps.players || pageProps.initialPlayers || Object.values(pageProps).find(val => Array.isArray(val)) || [];
            
            console.log(`Gefundene Valorant-Rohdaten im Speicher: ${playersList.length} Einträge.`);
            
            const valSelection = playersList.slice(0, 40);
            for (const p of valSelection) {
                if (!p) continue;
                const name = p.name || p.slug || p.playerName || "Unknown";
                const shareCode = p.crosshair_code || p.code || p.shareCode || p.share_code || "";
                
                if (shareCode) {
                    const parsedData = parseValorantConfig(shareCode);
                    
                    if (p.inner_length !== undefined) parsedData.inner_length = parseFloat(p.inner_length);
                    if (p.inner_thickness !== undefined) parsedData.inner_thickness = parseFloat(p.inner_thickness);
                    if (p.inner_gap !== undefined) parsedData.inner_gap = parseFloat(p.inner_gap);

                    let existingPro = presets.pros.find(ex => cleanName(ex.name) === cleanName(name) && ex.game === "Valorant");
                    if (existingPro) {
                        Object.assign(existingPro, parsedData, { share_code: shareCode });
                    } else {
                        presets.pros.push({ name, game: "Valorant", ...parsedData, share_code: shareCode });
                    }
                }
            }
        }

        // Speicherzeitpunkt festhalten
        presets.lastUpdated = new Date().toLocaleString('de-DE');
        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log("\nErfolgreich! presets.json wurde fehlerfrei aktualisiert.");

    } catch (error) {
        console.error("Kritischer Fehler:", error.message);
    }
}

run();
