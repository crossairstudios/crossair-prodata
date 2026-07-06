const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const PRESETS_PATH = path.join(__dirname, 'presets.json');
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Regex Definition ohne Syntax-Fehler
const shareCodeRegex = /(CSGO-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5})/i;

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

function parseCS2Config(consoleStr) {
    // Falls kein String, Fallback
    if (!consoleStr) return { cl_crosshairsize: 2, cl_crosshairthickness: 1, cl_crosshairgap: -2, cl_crosshairdot: 0, color: "#00ff00" };

    const getVal = (regex) => {
        const match = consoleStr.match(regex);
        return match ? parseFloat(match[1]) : null;
    };

    return {
        cl_crosshairsize: getVal(/cl_crosshairsize\s+([0-9.-]+)/i) ?? 2,
        cl_crosshairthickness: getVal(/cl_crosshairthickness\s+([0-9.-]+)/i) ?? 1,
        cl_crosshairgap: getVal(/cl_crosshairgap\s+([0-9.-]+)/i) ?? -2,
        cl_crosshairdot: getVal(/cl_crosshairdot\s+([0-9.-]+)/i) ?? 0,
        color: rgbToHex(getVal(/cl_crosshaircolor_r\s+([0-9]+)/i), getVal(/cl_crosshaircolor_g\s+([0-9]+)/i), getVal(/cl_crosshaircolor_b\s+([0-9]+)/i))
    };
}

function cleanName(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
    try {
        const baseUrl = 'https://procrosshairs.com';
        let presets = fs.existsSync(PRESETS_PATH) ? JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8')) : { pros: [] };
        
        console.log("Starte Scraper...");
        const html = await axios.get(baseUrl, httpOptions);
        const $ = cheerio.load(html.data);
        const urls = [];
        
        $('a[href*="/player/"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href && !href.includes('/valorant/') && urls.length < 40) {
                urls.push(baseUrl + href);
            }
        });

        for (const url of urls) {
            const urlName = url.split('/').pop();
            console.log(`Analysiere: ${urlName}`);
            
            try {
                const response = await axios.get(url, httpOptions);
                const $p = cheerio.load(response.data);
                
                // 1. Next.js JSON versuchen
                const nextData = JSON.parse($p('#__NEXT_DATA__').html() || '{}');
                const player = nextData.props?.pageProps?.player;
                
                // 2. Fallbacks, falls JSON nicht direkt greift
                const shareCode = player?.crosshair_code || response.data.match(shareCodeRegex)?.[0];
                const consoleCommands = player?.console_commands || response.data;

                if (shareCode) {
                    const parsed = parseCS2Config(consoleCommands);
                    let existing = presets.pros.find(p => cleanName(p.name) === cleanName(urlName));
                    
                    if (existing) {
                        Object.assign(existing, parsed, { share_code: shareCode });
                    } else {
                        presets.pros.push({ name: urlName, game: "CS2", ...parsed, share_code: shareCode });
                    }
                    console.log(` -> OK: Gap ${parsed.cl_crosshairgap}`);
                } else {
                    console.log(` -> FEHLER: Kein Code gefunden.`);
                }
            } catch(e) {
                console.log(` -> Fehler: ${e.message}`);
            }
            await delay(2000);
        }

        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log("Fertig.");
    } catch (err) {
        console.error("Kritischer Fehler:", err.message);
    }
}

run();
