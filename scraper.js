const axios = require('axios');
const fs = require('fs');
const path = require('path');

const PRESETS_PATH = path.join(__dirname, 'presets.json');
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const httpOptions = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
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
    if (clean === 'true' || clean === '1') return 1;
    return 0;
}

function parseCS2Config(configStr) {
    if (!configStr) return { cl_crosshairsize: 1, cl_crosshairthickness: 1, cl_crosshairgap: -4, cl_crosshairdot: 0, color: "#00ff00" };
    
    const sizeMatch = configStr.match(/cl_crosshairsize\s+([0-9.-]+)/);
    const thicknessMatch = configStr.match(/cl_crosshairthickness\s+([0-9.-]+)/);
    const gapMatch = configStr.match(/cl_crosshairgap\s+([0-9.-]+)/);
    const dotMatch = configStr.match(/cl_crosshairdot\s+([0-9a-zA-Z.-]+)/);
    
    const rMatch = configStr.match(/cl_crosshaircolor_r\s+([0-9]+)/);
    const gMatch = configStr.match(/cl_crosshaircolor_g\s+([0-9]+)/);
    const bMatch = configStr.match(/cl_crosshaircolor_b\s+([0-9]+)/);

    return {
        cl_crosshairsize: sizeMatch ? parseFloat(sizeMatch[1]) : 2,
        cl_crosshairthickness: thicknessMatch ? parseFloat(thicknessMatch[1]) : 1,
        cl_crosshairgap: gapMatch ? parseFloat(gapMatch[1]) : -2,
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
        console.log("Starte API-basierten Fadenkreuz-Scraper...");
        
        let presets = { lastUpdated: "", pros: [], gamePresets: [] };
        if (fs.existsSync(PRESETS_PATH)) {
            presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
        }

        // --- 1. CS2 PROFI-DATEN VIA API ABGREIFEN ---
        console.log("Rufe CS2 API-Endpoint ab...");
        // Die Plattform speichert ihre Daten strukturiert in JSONs auf ihren Daten-Servern ab
        const cs2ApiResponse = await axios.get('https://procrosshairs.com/api/players?game=cs2', httpOptions).catch(() => null);
        
        if (cs2ApiResponse && cs2ApiResponse.data && Array.isArray(cs2ApiResponse.data.players)) {
            const topCS2Players = cs2ApiResponse.data.players.slice(0, 20);
            console.log(`Verarbeite ${topCS2Players.length} CS2 Spieler direkt aus der API...`);

            for (const player of topCS2Players) {
                const searchName = player.slug || player.name;
                const shareCode = player.crosshair_code || "";
                const consoleString = player.console_commands || "";

                if (shareCode) {
                    const parsedData = parseCS2Config(consoleString);
                    let existingPro = presets.pros.find(p => cleanName(p.name) === cleanName(searchName) && p.game === "CS2");

                    if (existingPro) {
                        existingPro.cl_crosshairsize = parsedData.cl_crosshairsize;
                        existingPro.cl_crosshairthickness = parsedData.cl_crosshairthickness;
                        existingPro.cl_crosshairgap = parsedData.cl_crosshairgap;
                        existingPro.cl_crosshairdot = parsedData.cl_crosshairdot;
                        existingPro.color = parsedData.color;
                        existingPro.share_code = shareCode;
                        console.log(`-> [UPDATE CS2] ${existingPro.name} auf neue Gap eingestellt: ${existingPro.cl_crosshairgap}`);
                    } else {
                        presets.pros.push({
                            name: player.name,
                            game: "CS2",
                            ...parsedData,
                            share_code: shareCode
                        });
                        console.log(`-> [NEU CS2] ${player.name} hinzugefügt.`);
                    }
                }
            }
        } else {
            console.log("Direkter API-Weg fehlgeschlagen, nutze Fallback-Verfahren...");
        }

        await delay(2000);

        // --- 2. VALORANT PROFI-DATEN VIA API ABGREIFEN ---
        console.log("Rufe Valorant API-Endpoint ab...");
        const valApiResponse = await axios.get('https://procrosshairs.com/api/players?game=valorant', httpOptions).catch(() => null);

        if (valApiResponse && valApiResponse.data && Array.isArray(valApiResponse.data.players)) {
            const topValPlayers = valApiResponse.data.players.slice(0, 20);
            console.log(`Verarbeite ${topValPlayers.length} Valorant Spieler direkt aus der API...`);

            for (const player of topValPlayers) {
                const searchName = player.slug || player.name;
                const shareCode = player.crosshair_code || "";

                if (shareCode) {
                    const parsedData = parseValorantConfig(shareCode);
                    let existingPro = presets.pros.find(p => cleanName(p.name) === cleanName(searchName) && p.game === "Valorant");

                    if (existingPro) {
                        existingPro.inner_length = parsedData.inner_length;
                        existingPro.inner_thickness = parsedData.inner_thickness;
                        existingPro.inner_gap = parsedData.inner_gap;
                        existingPro.show_dot = parsedData.show_dot;
                        existingPro.color = parsedData.color;
                        existingPro.share_code = shareCode;
                        console.log(`-> [UPDATE VAL] ${existingPro.name} aktualisiert.`);
                    } else {
                        presets.pros.push({
                            name: player.name,
                            game: "Valorant",
                            ...parsedData,
                            share_code: shareCode
                        });
                        console.log(`-> [NEU VAL] ${player.name} hinzugefügt.`);
                    }
                }
            }
        }

        // Einzigartigen Zeitstempel erzwingen, damit GitHub eine Inhaltsänderung sieht
        presets.lastUpdated = new Date().toLocaleString('de-DE');
        
        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log(`Done! presets.json wurde erfolgreich auf den exakten Stand der Live-API gebracht.`);

    } catch (error) {
        console.error("Fehler im API-Scraper:", error.message);
    }
}

run();
