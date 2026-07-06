const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const PRESETS_PATH = path.join(__dirname, 'presets.json');
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const httpOptions = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'de,en-US;q=0.7,en;q=0.3'
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

function cleanName(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
    try {
        console.log("Starte präzisen Element-Scraper (CS2 & Valorant)...");
        const baseUrl = 'https://procrosshairs.com';
        
        const cs2Urls = [];
        const valUrls = [];

        let presets = { lastUpdated: "", pros: [], gamePresets: [] };
        if (fs.existsSync(PRESETS_PATH)) {
            presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
        }

        // --- 1. CS2 LINKS SAMMELN ---
        console.log("Lade Hauptseite für CS2 Links...");
        const htmlCS2 = await axios.get(baseUrl, httpOptions);
        let $ = cheerio.load(htmlCS2.data);
        $('a[href*="/player/"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href && !href.includes('/valorant/')) {
                const fullUrl = href.startsWith('http') ? href : baseUrl + href;
                if (!cs2Urls.includes(fullUrl) && cs2Urls.length < 40) {
                    cs2Urls.push(fullUrl);
                }
            }
        });
        console.log(`Gefundene CS2 Spieler-URLs (${cs2Urls.length})`);

        // --- 2. VALORANT LINKS SAMMELN ---
        console.log("Lade Valorant-Übersicht für Valorant Links...");
        const htmlVal = await axios.get(`${baseUrl}/valorant`, httpOptions);
        $ = cheerio.load(htmlVal.data);
        $('a[href*="/player/valorant/"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href) {
                const fullUrl = href.startsWith('http') ? href : baseUrl + href;
                if (!valUrls.includes(fullUrl) && valUrls.length < 40) {
                    valUrls.push(fullUrl);
                }
            }
        });
        console.log(`Gefundene Valorant Spieler-URLs (${valUrls.length})`);

        // --- 3. CS2 PRO_SEITEN PARSEN VIA ATTRIBUTEN ---
        for (const url of cs2Urls) {
            const urlName = url.split('/').pop();
            console.log(`[CS2] Analyse für: ${urlName}...`);
            try {
                const profilePage = await axios.get(url, httpOptions);
                const $p = cheerio.load(profilePage.data);

                // Sucht nach Elementen, die den Share-Code oder die Befehle im Text/Attribut halten
                let consoleString = "";
                let shareCode = "";

                // Wir suchen nach dem Input oder Button, der die Config kopiert
                $p('input, button, div').each((i, el) => {
                    const val = $p(el).val() || $p(el).attr('data-copy') || $p(el).text() || "";
                    if (val.includes('cl_crosshairgap') && !consoleString) {
                        consoleString = val;
                    }
                    const codeMatch = val.match(/CSGO-[A-Za-z0-9-]+-[A-Za-z0-9-]+-[A-Za-z0-9-]+-[A-Za-z0-9-]+-[A-Za-z0-9-]+/);
                    if (codeMatch && !shareCode) {
                        shareCode = codeMatch[0];
                    }
                });

                // Letzter Fallback über die gesamte Seite falls die Schleife fehlschlägt
                if (!shareCode) {
                    const pageText = $p.text();
                    const codeMatch = pageText.match(/CSGO-[A-Za-z0-9-]+-[A-Za-z0-9-]+-[A-Za-z0-9-]+-[A-Za-z0-9-]+-[A-Za-z0-9-]+/);
                    if (codeMatch) shareCode = codeMatch[0];
                }

                if (shareCode) {
                    const parsedData = parseCS2Config(consoleString || $p.text());
                    let existingPro = presets.pros.find(p => cleanName(p.name) === cleanName(urlName) && p.game === "CS2");

                    if (existingPro) {
                        existingPro.cl_crosshairsize = parsedData.cl_crosshairsize;
                        existingPro.cl_crosshairthickness = parsedData.cl_crosshairthickness;
                        existingPro.cl_crosshairgap = parsedData.cl_crosshairgap;
                        existingPro.cl_crosshairdot = parsedData.cl_crosshairdot;
                        existingPro.color = parsedData.color;
                        existingPro.share_code = shareCode;
                        console.log(`   -> Aktualisiert: Gap ${existingPro.cl_crosshairgap}`);
                    } else {
                        const displayName = urlName.charAt(0).toUpperCase() + urlName.slice(1);
                        presets.pros.push({
                            name: displayName,
                            game: "CS2",
                            ...parsedData,
                            share_code: shareCode
                        });
                        console.log(`   -> Neu hinzugefügt.`);
                    }
                } else {
                    console.log(`   -> [FEHLER] Kein Code extrahierbar.`);
                }
                await delay(3500);
            } catch(e) {
                console.error(`Fehler bei CS2 Spieler ${urlName}:`, e.message);
            }
        }

        // --- 4. VALORANT PRO_SEITEN PARSEN VIA ATTRIBUTEN ---
        for (const url of valUrls) {
            const urlName = url.split('/').pop();
            console.log(`[Valorant] Analyse für: ${urlName}...`);
            try {
                const profilePage = await axios.get(url, httpOptions);
                const $p = cheerio.load(profilePage.data);

                let shareCode = "";
                $p('input, button, div').each((i, el) => {
                    const val = $p(el).val() || $p(el).attr('data-copy') || $p(el).text() || "";
                    const valCodeMatch = val.match(/0;P;[A-Za-z0-9;.-]+/);
                    if (valCodeMatch && !shareCode) {
                        shareCode = valCodeMatch[0];
                    }
                });

                if (!shareCode) {
                    const valCodeMatch = $p.text().match(/0;P;[A-Za-z0-9;.-]+/);
                    if (valCodeMatch) shareCode = valCodeMatch[0];
                }

                if (shareCode) {
                    const parsedData = parseValorantConfig(shareCode);
                    let existingPro = presets.pros.find(p => cleanName(p.name) === cleanName(urlName) && p.game === "Valorant");

                    if (existingPro) {
                        existingPro.inner_length = parsedData.inner_length;
                        existingPro.inner_thickness = parsedData.inner_thickness;
                        existingPro.inner_gap = parsedData.inner_gap;
                        existingPro.show_dot = parsedData.show_dot;
                        existingPro.color = parsedData.color;
                        existingPro.share_code = shareCode;
                        console.log(`   -> Aktualisiert.`);
                    } else {
                        const displayName = urlName.charAt(0).toUpperCase() + urlName.slice(1);
                        presets.pros.push({
                            name: displayName,
                            game: "Valorant",
                            ...parsedData,
                            share_code: shareCode
                        });
                        console.log(`   -> Neu hinzugefügt.`);
                    }
                }
                await delay(3500);
            } catch(e) {
                console.error(`Fehler bei Valorant Spieler ${urlName}:`, e.message);
            }
        }

        presets.lastUpdated = new Date().toLocaleString('de-DE');
        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log("\nErfolgreich beendet!");

    } catch (error) {
        console.error("Kritischer Fehler im Hauptprozess:", error.message);
    }
}

run();
