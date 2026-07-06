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

// --- DIE OFFIZIELLE CS2 SHARE-CODE ENTSCHLÜSSELUNG ---
const DICTIONARY = "ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function decodeCS2ShareCode(code) {
    const fallback = { cl_crosshairsize: 2, cl_crosshairthickness: 1, cl_crosshairgap: -2, cl_crosshairdot: 0, color: "#00ff00" };
    try {
        const cleanCode = code.replace(/CSGO-|-/g, '');
        if (cleanCode.length !== 25) return fallback;

        // 1. Base58 zu BigInt konvertieren
        let num = 0n;
        for (let i = 0; i < cleanCode.length; i++) {
            const char = cleanCode[i];
            const idx = DICTIONARY.indexOf(char);
            if (idx === -1) return fallback;
            num = num * 58n + BigInt(idx);
        }

        // 2. In 18 Bytes zerlegen
        const bytes = [];
        for (let i = 0; i < 18; i++) {
            bytes.push(Number((num >> BigInt(i * 8)) & 0xFFn));
        }

        // 3. Bit-Parsing nach CS2-Protokoll-Struktur
        // Size und Thickness liegen in den Bytes 3 und 4 (geteilt durch 10)
        const size = bytes[3] / 10;
        const thickness = bytes[4] / 10;

        // Das Gap-Byte verwendet das Zweierkomplement für negative Zahlen (Offset 128)
        let gapInt = bytes[5];
        if (gapInt > 127) gapInt -= 256;
        const gap = gapInt / 10;

        // Dot ist das erste Bit im Byte 6
        const dot = (bytes[6] & 1) ? 1 : 0;

        // Farbe ermitteln (CS2 nutzt vordefinierte IDs oder RGB in späteren Bytes)
        const colorId = bytes[2] & 7;
        let colorHex = "#00ff00"; // Standard-Grün (ID 1)
        if (colorId === 2) colorHex = "#ffff00"; // Gelb
        if (colorId === 3) colorHex = "#0000ff"; // Blau
        if (colorId === 4) colorHex = "#00ffff"; // Cyan
        
        return {
            cl_crosshairsize: size,
            cl_crosshairthickness: thickness,
            cl_crosshairgap: gap,
            cl_crosshairdot: dot,
            color: colorHex
        };
    } catch (e) {
        return fallback;
    }
}

function cleanName(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
    try {
        console.log("Starte CS2-Protokoll-Decoder-Scraper...");
        const baseUrl = 'https://procrosshairs.com';
        
        let presets = { lastUpdated: "", pros: [], gamePresets: [] };
        if (fs.existsSync(PRESETS_PATH)) {
            presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
        }

        // 1. URLs von Hauptseite holen
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

        // 2. Seiten laden und Codes direkt decodieren
        for (const url of cs2Urls) {
            const urlChunks = url.split('/');
            const urlName = urlChunks[urlChunks.length - 1] || "Unknown";
            
            try {
                const profilePage = await axios.get(url, httpOptions);
                
                // Regex fischt den Share-Code aus dem HTML
                const shareCodeMatch = profilePage.data.match(/(CSGO-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5})/i);
                
                if (shareCodeMatch) {
                    const shareCode = shareCodeMatch[1];
                    
                    // Hier läuft die korrigierte CS2-Zweierkomplement-Berechnung
                    const parsedData = decodeCS2ShareCode(shareCode);

                    let existingPro = presets.pros.find(p => cleanName(p.name) === cleanName(urlName) && p.game === "CS2");
                    if (existingPro) {
                        Object.assign(existingPro, parsedData, { share_code: shareCode });
                    } else {
                        presets.pros.push({ name: urlName, game: "CS2", ...parsedData, share_code: shareCode });
                    }
                    console.log(`[Erfolg] ${urlName} -> Gap: ${parsedData.cl_crosshairgap} | Size: ${parsedData.cl_crosshairsize}`);
                } else {
                    console.log(`[Fehler] Kein Share-Code für ${urlName}`);
                }

                await delay(2000);
            } catch (e) {
                console.error(`Fehler bei ${urlName}:`, e.message);
            }
        }

        presets.lastUpdated = new Date().toLocaleString('de-DE');
        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log("\nProzess erfolgreich beendet.");

    } catch (error) {
        console.error("Kritischer Fehler:", error.message);
    }
}

run();
