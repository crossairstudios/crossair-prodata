const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const PRESETS_PATH = path.join(__dirname, 'presets.json');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function rgbToHex(r, g, b) {
    if (r === undefined || g === undefined || b === undefined) return "#00ff00";
    const toHex = (c) => {
        const hex = Math.max(0, Math.min(255, parseInt(c))).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Hilfsfunktion um "true"/"1" zu 1 und "false"/"0" zu 0 zu machen
function parseBooleanOrNumber(val) {
    if (!val) return 0;
    const clean = val.trim().toLowerCase();
    if (clean === 'true' || clean === '1') return 1;
    return 0;
}

// Überarbeiteter CS2 Parser, der auch "false" und "true" abfängt
function parseCS2Config(configStr) {
    const sizeMatch = configStr.match(/cl_crosshairsize\s+([0-9.-]+)/);
    const thicknessMatch = configStr.match(/cl_crosshairthickness\s+([0-9.-]+)/);
    const gapMatch = configStr.match(/cl_crosshairgap\s+([0-9.-]+)/);
    
    // Fängt jetzt ([0-9]+|true|false) ab!
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

// Bereinigt Namen von URLs (z.B. "niko" -> "niko") für den sauberen Abgleich
function cleanName(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
    try {
        console.log("Starte Fadenkreuz-Scraper...");
        const baseUrl = 'https://procrosshairs.com';
        
        const cs2Urls = [];
        const valUrls = [];

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

        let presets = { lastUpdated: "", pros: [], gamePresets: [] };
        if (fs.existsSync(PRESETS_PATH)) {
            presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
        }

        // CS2 verarbeiten
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

                    // Extrem sicherer, bereinigter Abgleich
                    let existingPro = presets.pros.find(p => cleanName(p.name) === cleanName(urlName) && p.game === "CS2");

                    if (existingPro) {
                        // FORCE-UPDATE: Wir überschreiben JETZT gnadenlos alle Werte
                        existingPro.cl_crosshairsize = parsedData.cl_crosshairsize;
                        existingPro.cl_crosshairthickness = parsedData.cl_crosshairthickness;
                        existingPro.cl_crosshairgap = parsedData.cl_crosshairgap;
                        existingPro.cl_crosshairdot = parsedData.cl_crosshairdot;
                        existingPro.color = parsedData.color;
                        existingPro.share_code = shareCode;
                        console.log(`-> Werte für ${existingPro.name} aktualisiert! (Gap: ${existingPro.cl_crosshairgap})`);
                    } else {
                        presets.pros.push({
                            name: displayName,
                            game: "CS2",
                            ...parsedData,
                            share_code: shareCode
                        });
                        console.log(`-> ${displayName} neu hinzugefügt!`);
                    }
                }
                await delay(5000);
            } catch (err) {
                console.error(`Fehler bei CS2 URL ${url}:`, err.message);
            }
        }

        // Valorant verarbeiten
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

                    let existingPro = presets.pros.find(p => cleanName(p.name) === cleanName(urlName) && p.game === "Valorant");

                    if (existingPro) {
                        existingPro.inner_length = parsedData.inner_length;
                        existingPro.inner_thickness = parsedData.inner_thickness;
                        existingPro.inner_gap = parsedData.inner_gap;
                        existingPro.show_dot = parsedData.show_dot;
                        existingPro.color = parsedData.color;
                        existingPro.share_code = shareCode;
                        console.log(`-> Werte für ${existingPro.name} (Val) aktualisiert!`);
                    } else {
                        presets.pros.push({
                            name: displayName,
                            game: "Valorant",
                            ...parsedData,
                            share_code: shareCode
                        });
                    }
                }
                await delay(5000);
            } catch (err) {
                console.error(`Fehler bei Valorant URL ${url}:`, err.message);
            }
        }

        presets.lastUpdated = new Date().toLocaleDateString('de-DE');
        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log("presets.json erfolgreich überschrieben!");

    } catch (error) {
        console.error("Kritischer globaler Fehler:", error);
    }
}

run();
