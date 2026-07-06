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

function cleanName(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
    try {
        console.log("Starte Debug-Hybrid-Scraper...");
        const baseUrl = 'https://procrosshairs.com';
        
        const cs2Urls = [];
        let presets = { lastUpdated: "", pros: [], gamePresets: [] };
        if (fs.existsSync(PRESETS_PATH)) {
            presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
        }

        console.log("Lade Hauptseite für CS2 Links...");
        const htmlCS2 = await axios.get(baseUrl, httpOptions);
        let $ = cheerio.load(htmlCS2.data);
        
        // Debug: Zeige alle gefundenen Links an
        console.log(`Gesamtzahl aller Links auf der Startseite: ${$('a').length}`);

        $('a[href*="/player/"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href && (href.includes('/cs2/') || !href.includes('/valorant/'))) {
                const fullUrl = href.startsWith('http') ? href : baseUrl + href;
                if (!cs2Urls.includes(fullUrl) && cs2Urls.length < 15) {
                    cs2Urls.push(fullUrl);
                }
            }
        });

        console.log(`Gefundene CS2 Spieler-URLs (${cs2Urls.length}):`, cs2Urls);

        if (cs2Urls.length === 0) {
            console.log("[Achtung] Keine URLs gefunden! Versuche alternativen Selektor...");
            $('a').each((i, el) => {
                const href = $(el).attr('href') || "";
                if(href.includes('player')) {
                     console.log(`Möglicher Treffer über Hauptselektor: ${href}`);
                }
            });
        }

        // Schleife abfahren
        for (const url of cs2Urls) {
            const urlName = url.split('/').pop();
            console.log(`\n--- Starte Analyse für: ${urlName} ---`);
            console.log(`Lade URL: ${url}`);
            
            try {
                const profilePage = await axios.get(url, httpOptions);
                const $p = cheerio.load(profilePage.data);
                const rawHtml = profilePage.data;

                let shareCode = "";
                let consoleString = "";

                // Versuch 1: Next.js JSON Speicher
                const nextDataScript = $p('#__NEXT_DATA__').html();
                if (nextDataScript) {
                    console.log(`[INFO] __NEXT_DATA__ auf der Seite von ${urlName} gefunden.`);
                    try {
                        const nextData = JSON.parse(nextDataScript);
                        const playerData = nextData.props?.pageProps?.player;
                        if (playerData) {
                            shareCode = playerData.crosshair_code || "";
                            consoleString = playerData.console_commands || "";
                            console.log(`[JSON-Erfolg] Code: ${shareCode}, Befehle gefunden.`);
                        }
                    } catch(e) {
                        console.log("[JSON-Fehler] Konnte NEXT_DATA nicht parsen.");
                    }
                }

                // Versuch 2: Regex-Fallback falls JSON leer war
                if (!shareCode) {
                    console.log("[Fallback] Suche über Text-Muster (Regex)...");
                    const shareCodeMatch = rawHtml.match(/CSGO-[A-Za-z0-9-]+-[A-Za-z0-9-]+-[A-Za-z0-9-]+-[A-Za-z0-9-]+-[A-Za-z0-9-]+/);
                    const consoleStringMatch = rawHtml.match(/cl_crosshairgap\s+[^"]+/);
                    
                    if (shareCodeMatch) {
                        shareCode = shareCodeMatch[0];
                        consoleString = consoleStringMatch ? consoleStringMatch[0] : "";
                        console.log(`[Regex-Erfolg] Code im Text gefunden: ${shareCode}`);
                    }
                }

                if (shareCode) {
                    const parsedData = parseCS2Config(consoleString || rawHtml);
                    let existingPro = presets.pros.find(p => cleanName(p.name) === cleanName(urlName) && p.game === "CS2");

                    if (existingPro) {
                        existingPro.cl_crosshairsize = parsedData.cl_crosshairsize;
                        existingPro.cl_crosshairthickness = parsedData.cl_crosshairthickness;
                        existingPro.cl_crosshairgap = parsedData.cl_crosshairgap;
                        existingPro.cl_crosshairdot = parsedData.cl_crosshairdot;
                        existingPro.color = parsedData.color;
                        existingPro.share_code = shareCode;
                        console.log(`[AKTUALISIERT] ${existingPro.name} auf Gap ${existingPro.cl_crosshairgap} gesetzt.`);
                    } else {
                        const displayName = urlName.charAt(0).toUpperCase() + urlName.slice(1);
                        presets.pros.push({
                            name: displayName,
                            game: "CS2",
                            ...parsedData,
                            share_code: shareCode
                        });
                        console.log(`[NEU] ${displayName} hinzugefügt.`);
                    }
                } else {
                    console.log(`[FEHLER] Absolut kein Share-Code für Spieler ${urlName} auffindbar.`);
                }

                await delay(4000);
            } catch(e) {
                console.error(`Fehler beim Abruf von ${urlName}:`, e.message);
            }
        }

        presets.lastUpdated = new Date().toLocaleString('de-DE');
        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log("\nSpeichern in presets.json erfolgreich beendet.");

    } catch (error) {
        console.error("Kritischer Fehler:", error.message);
    }
}

run();
