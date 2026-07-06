const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const PRESETS_PATH = path.join(__dirname, 'presets.json');
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Getarnte Header, damit die Webseite uns wie einen echten Browser behandelt
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
    const clean = val.trim().toLowerCase();
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
        console.log("Starte Fadenkreuz-Scraper mit Browser-Emulation...");
        const baseUrl = 'https://procrosshairs.com';
        
        const cs2Urls = [];
        const valUrls = [];

        console.log("Lese CS2 Übersichtsseite ein...");
        const htmlCS2 = await axios.get(baseUrl, httpOptions);
        let $ = cheerio.load(htmlCS2.data);
        $('a[href*="/player/cs2/"]').each((i, el) => {
            if (cs2Urls.length < 20) {
                const href = $(el).attr('href');
                const fullUrl = href.startsWith('http') ? href : baseUrl + href;
                if (!cs2Urls.includes(fullUrl)) cs2Urls.push(fullUrl);
            }
        });

        console.log("Lese Valorant Übersichtsseite ein...");
        const htmlVal = await axios.get(`${baseUrl}/valorant`, httpOptions);
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
                
                const profilePage = await axios.get(url, httpOptions);
                const rawHtml = profilePage.data;

                const shareCodeMatch = rawHtml.match(/CSGO-[A-Za-z0-9-]+-[A-Za-z0-9-]+-[A-Za-z0-9-]+-[A-Za-z0-9-]+-[A-Za-z0-9-]+/);
                const consoleStringMatch = rawHtml.match(/cl_crosshairgap\s+[^"]+/);

                const shareCode = shareCodeMatch ? shareCodeMatch[0] : "";
                const consoleString = consoleStringMatch ? consoleStringMatch[0] : "";

                if (shareCode) {
                    const parsedData = parseCS2Config(consoleString || rawHtml);
                    const displayName = urlName.charAt(0).toUpperCase() + urlName.slice(1);

                    let existingPro = presets.pros.find(p => cleanName(p.name) === cleanName(urlName) && p.game === "CS2");

                    if (existingPro) {
                        existingPro.cl_crosshairsize = parsedData.cl_crosshairsize;
                        existingPro.cl_crosshairthickness = parsedData.cl_crosshairthickness;
                        existingPro.cl_crosshairgap = parsedData.cl_crosshairgap;
                        existingPro.cl_crosshairdot = parsedData.cl_crosshairdot;
                        existingPro.color = parsedData.color;
                        existingPro.share_code = shareCode;
                        console.log(`[UPDATE] ${existingPro.name} -> Code: ${shareCode.substring(0,10)}... | Gap: ${existingPro.cl_crosshairgap}`);
                    } else {
                        presets.pros.push({
                            name: displayName,
                            game: "CS2",
                            ...parsedData,
                            share_code: shareCode
                        });
                        console.log(`[NEU] ${displayName} hinzugefügt.`);
                    }
                } else {
                    console.log(`[WARNUNG] Kein Code im HTML-Text gefunden für: ${urlName}`);
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
                
                const profilePage = await axios.get(url, httpOptions);
                const rawHtml = profilePage.data;

                const valCodeMatch = rawHtml.match(/0;P;[A-Za-z0-9;.-]+/);
                const shareCode = valCodeMatch ? valCodeMatch[0] : "";

                if (shareCode) {
                    const parsedData = parseValorantConfig(shareCode);
                    const displayName = urlName.charAt(0).toUpperCase() + urlName.slice(1);

                    let existingPro = presets.pros.find(p => cleanName(p.name) === cleanName(urlName) && p.game === "Valorant");

                    if (existingPro) {
                        existingPro.inner_length = parsedData.inner_length;
                        existingPro.inner_thickness = parsedData.inner_thickness;
                        existingPro.inner_gap = parsedData.inner_gap;
                        existingPro.show_dot = parsedData.show_dot;
                        existingPro.color = parsedData.color;
                        existingPro.share_code = shareCode;
                        console.log(`[UPDATE] ${existingPro.name} (VAL) -> Code gefunden.`);
                    } else {
                        presets.pros.push({
                            name: displayName,
                            game: "Valorant",
                            ...parsedData,
                            share_code: shareCode
                        });
                        console.log(`[NEU] ${displayName} (VAL) hinzugefügt.`);
                    }
                } else {
                    console.log(`[WARNUNG] Kein Valorant-Code gefunden für: ${urlName}`);
                }
                await delay(5000);
            } catch (err) {
                console.error(`Fehler bei Valorant URL ${url}:`, err.message);
            }
        }

        // Zwingt GitHub Actions dazu, die Datei zu aktualisieren, indem wir den Zeitstempel sekundengenau setzen
        presets.lastUpdated = new Date().toLocaleString('de-DE');
        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log("Speichern abgeschlossen.");

    } catch (error) {
        console.error("Kritischer globaler Fehler:", error);
    }
}

run();
