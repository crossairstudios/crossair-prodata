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
    if (r === undefined || g === undefined || b === undefined) return "#00ff00";
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
    if (!configStr) return { cl_crosshairsize: 2, cl_crosshairthickness: 1, cl_crosshairgap: -2, cl_crosshairdot: 0, color: "#00ff00" };

    const sizeMatch = configStr.match(/cl_crosshairsize\s+([0-9.-]+)/i);
    const thicknessMatch = configStr.match(/cl_crosshairthickness\s+([0-9.-]+)/i);
    const gapMatch = configStr.match(/cl_crosshairgap\s+([0-9.-]+)/i);
    const dotMatch = configStr.match(/cl_crosshairdot\s+([0-9.-]+)/i);
    
    const rMatch = configStr.match(/cl_crosshaircolor_r\s+([0-9]+)/i);
    const gMatch = configStr.match(/cl_crosshaircolor_g\s+([0-9]+)/i);
    const bMatch = configStr.match(/cl_crosshaircolor_b\s+([0-9]+)/i);

    return {
        cl_crosshairsize: sizeMatch ? parseFloat(sizeMatch[1]) : 2,
        cl_crosshairthickness: thicknessMatch ? parseFloat(thicknessMatch[1]) : 1,
        cl_crosshairgap: gapMatch ? parseFloat(gapMatch[1]) : -2, // Hier kommt das echte extrahierte Gap rein!
        cl_crosshairdot: dotMatch ? parseBooleanOrNumber(dotMatch[1]) : 0,
        color: rgbToHex(rMatch?.[1], gMatch?.[1], bMatch?.[1])
    };
}

function parseValorantConfig(configStr) {
    if (!configStr) return { inner_length: 4, inner_thickness: 2, inner_gap: 2, show_dot: false, color: "#00ff00" };
    
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
        console.log("Starte All-in-One PopUp-Massen-Scraper...");
        const baseUrl = 'https://procrosshairs.com';
        
        let presets = { lastUpdated: "", pros: [], gamePresets: [] };
        if (fs.existsSync(PRESETS_PATH)) {
            presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
        }

        // --- 1. CS2 DATEN AUS DER STARTSEITE EXTRAHIEREN ---
        console.log("Lade CS2 Hauptseite...");
        const responseCS2 = await axios.get(baseUrl, httpOptions);
        const $cs2 = cheerio.load(responseCS2.data);
        
        const nextDataCS2Text = $cs2('#__NEXT_DATA__').html();
        if (nextDataCS2Text) {
            const nextData = JSON.parse(nextDataCS2Text);
            // Suchen des globalen Spieler-Arrays im Next.js Speicher (oft in pageProps.players oder pageProps.fallback)
            const pageProps = nextData.props?.pageProps || {};
            // Wir suchen dynamisch nach einem Array, das Spieler enthält
            const playersList = pageProps.players || pageProps.initialPlayers || Object.values(pageProps).find(val => Array.isArray(val)) || [];
            
            console.log(`Gefundene CS2-Rohdaten im Speicher: ${playersList.length} Spieler.`);
            
            // Die ersten 40 CS2-Spieler verarbeiten
            const cs2Selection = playersList.slice(0, 40);
            for (const p of cs2Selection) {
                const name = p.name || p.slug || "Unknown";
                const shareCode = p.crosshair_code || p.code || "";
                const consoleCommands = p.console_commands || p.commands || "";
                
                if (shareCode) {
                    const parsedData = parseCS2Config(consoleCommands);
                    let existingPro = presets.pros.find(ex => cleanName(ex.name) === cleanName(name) && ex.game === "CS2");
                    
                    if (existingPro) {
                        Object.assign(existingPro, parsedData, { share_code: shareCode });
                        console.log(`[CS2] Aktualisiert: ${name} -> Gap ${existingPro.cl_crosshairgap}`);
                    } else {
                        presets.pros.push({ name, game: "CS2", ...parsedData, share_code: shareCode });
                        console.log(`[CS2] Neu: ${name}`);
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
            
            console.log(`Gefundene Valorant-Rohdaten im Speicher: ${playersList.length} Spieler.`);
            
            const valSelection = playersList.slice(0, 40);
            for (const p of valSelection) {
                const name = p.name || p.slug || "Unknown";
                const shareCode = p.crosshair_code || p.code || "";
                
                if (shareCode) {
                    const parsedData = parseValorantConfig(shareCode);
                    let existingPro = presets.pros.find(ex => cleanName(ex.name) === cleanName(name) && ex.game === "Valorant");
                    
                    if (existingPro) {
                        Object.assign(existingPro, parsedData, { share_code: shareCode });
                        console.log(`[Valorant] Aktualisiert: ${name}`);
                    } else {
                        presets.pros.push({ name, game: "Valorant", ...parsedData, share_code: shareCode });
                        console.log(`[Valorant] Neu: ${name}`);
                    }
                }
            }
        }

        // Speichern
        presets.lastUpdated = new Date().toLocaleString('de-DE');
        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log("\nErfolgreich! presets.json wurde aktualisiert.");

    } catch (error) {
        console.error("Kritischer Fehler:", error.message);
    }
}

run();
