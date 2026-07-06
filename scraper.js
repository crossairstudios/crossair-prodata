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

function parseCS2Config(htmlText) {
    // Da Astro Variablen im JavaScript-Format speichert, suchen wir nach "size": X oder cl_crosshairsize X
    const sizeMatch = htmlText.match(/"size"\s*:\s*([0-9.-]+)/i) || htmlText.match(/cl_crosshairsize\s+([0-9.-]+)/i);
    const thicknessMatch = htmlText.match(/"thickness"\s*:\s*([0-9.-]+)/i) || htmlText.match(/cl_crosshairthickness\s+([0-9.-]+)/i);
    const gapMatch = htmlText.match(/"gap"\s*:\s*([0-9.-]+)/i) || htmlText.match(/cl_crosshairgap\s+([0-9.-]+)/i);
    const dotMatch = htmlText.match(/"dot"\s*:\s*([0-9.-]+|true|false)/i) || htmlText.match(/cl_crosshairdot\s+([0-9.-]+)/i);
    
    const rMatch = htmlText.match(/"color_r"\s*:\s*([0-9]+)/i) || htmlText.match(/cl_crosshaircolor_r\s+([0-9]+)/i);
    const gMatch = htmlText.match(/"color_g"\s*:\s*([0-9]+)/i) || htmlText.match(/cl_crosshaircolor_g\s+([0-9]+)/i);
    const bMatch = htmlText.match(/"color_b"\s*:\s*([0-9]+)/i) || htmlText.match(/cl_crosshaircolor_b\s+([0-9]+)/i);

    let isDot = 0;
    if (dotMatch) {
        const d = dotMatch[1].toLowerCase();
        isDot = (d === 'true' || d === '1') ? 1 : 0;
    }

    return {
        cl_crosshairsize: sizeMatch ? parseFloat(sizeMatch[1]) : 2,
        cl_crosshairthickness: thicknessMatch ? parseFloat(thicknessMatch[1]) : 1,
        cl_crosshairgap: gapMatch ? parseFloat(gapMatch[1]) : -2,
        cl_crosshairdot: isDot,
        color: rgbToHex(rMatch?.[1], gMatch?.[1], bMatch?.[1])
    };
}

function parseValorantConfig(htmlText) {
    const codeMatch = htmlText.match(/0;P;[A-Za-z0-9;.-]+/);
    const shareCode = codeMatch ? codeMatch[0] : "";

    const lengthMatch = htmlText.match(/0l;([0-9.-]+)/);
    const thicknessMatch = htmlText.match(/0t;([0-9.-]+)/);
    const gapMatch = htmlText.match(/0o;([0-9.-]+)/);
    const dotMatch = htmlText.match(/d;([0-1]|true|false)/);

    return {
        share_code: shareCode,
        inner_length: lengthMatch ? parseFloat(lengthMatch[1]) : 4,
        inner_thickness: thicknessMatch ? parseFloat(thicknessMatch[1]) : 2,
        inner_gap: gapMatch ? parseFloat(gapMatch[1]) : 2,
        show_dot: dotMatch ? (dotMatch[1] === "1" || dotMatch[1] === "true") : false,
        color: "#00ff00"
    };
}

function cleanName(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
    try {
        console.log("Starte Astro-basierten URL-Massen-Scraper...");
        const baseUrl = 'https://procrosshairs.com';
        
        let presets = { lastUpdated: "", pros: [], gamePresets: [] };
        if (fs.existsSync(PRESETS_PATH)) {
            presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
        }

        // --- 1. SIND DIE LINKS AM START? ---
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
        console.log(`Gefundene echte CS2 Spieler-URLs: ${cs2Urls.length}`);

        // --- 2. SPIELERSEITEN PARSEN ---
        for (const url of cs2Urls) {
            const urlChunks = url.split('/');
            const urlName = urlChunks[urlChunks.length - 1] || "Unknown";
            
            console.log(`Scrape Spieler: ${urlName}...`);
            try {
                const profilePage = await axios.get(url, httpOptions);
                const pageHtml = profilePage.data;

                // Finde den CS2 Share Code
                const shareCodeMatch = pageHtml.match(/(CSGO-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5})/i);
                
                if (shareCodeMatch) {
                    const shareCode = shareCodeMatch[1];
                    const parsedData = parseCS2Config(pageHtml);

                    let existingPro = presets.pros.find(p => cleanName(p.name) === cleanName(urlName) && p.game === "CS2");
                    if (existingPro) {
                        Object.assign(existingPro, parsedData, { share_code: shareCode });
                        console.log(`   -> Aktualisiert: Gap ${existingPro.cl_crosshairgap}, Size ${existingPro.cl_crosshairsize}`);
                    } else {
                        presets.pros.push({ name: urlName, game: "CS2", ...parsedData, share_code: shareCode });
                        console.log(`   -> Neu hinzugefügt.`);
                    }
                } else {
                    console.log(`   -> Fehler: Kein Share-Code auf der Seite gefunden.`);
                }

                await delay(2500); // Höflichkeits-Delay gegen Rate-Limits
            } catch (e) {
                console.error(`Fehler bei ${urlName}:`, e.message);
            }
        }

        // Speichern
        presets.lastUpdated = new Date().toLocaleString('de-DE');
        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log("\nFertig! presets.json wurde erfolgreich gefüllt.");

    } catch (error) {
        console.error("Kritischer Hauptfehler:", error.message);
    }
}

run();
