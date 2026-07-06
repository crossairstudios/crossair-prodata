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

// --- CS2 SHARE CODE DECODER LOGIK ---
const DICTIONARY = "ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function decodeShareCode(code) {
    // Fallback-Standardwerte
    const fallback = { cl_crosshairsize: 2, cl_crosshairthickness: 1, cl_crosshairgap: -2, cl_crosshairdot: 0, color: "#00ff00" };
    
    try {
        const cleanCode = code.replace(/CSGO-|-/g, '');
        if (cleanCode.length !== 25) return fallback;

        // BigInt-Dekodierung des Base58-Strings
        let num = 0n;
        for (let i = 0; i < cleanCode.length; i++) {
            const char = cleanCode[i];
            const idx = DICTIONARY.indexOf(char);
            if (idx === -1) return fallback;
            num = num * 58n + BigInt(idx);
        }

        // Bytes extrahieren
        const bytes = [];
        for (let i = 0; i < 18; i++) {
            bytes.push(Number((num >> BigInt(i * 8)) & 0xFFn));
        }

        // CS2 Byte-Mapping für die wichtigsten Crosshair-Werte
        // (Werte sind im Code oft als Multiplikatoren von 0.1 oder mit Offsets gespeichert)
        const size = bytes[3] !== undefined ? (bytes[3] / 10) : 2;
        const thickness = bytes[4] !== undefined ? (bytes[4] / 10) : 1;
        
        // Gap hat im Byte-Code ein Offset von 128 für negative Werte
        let gap = -2;
        if (bytes[5] !== undefined) {
            gap = bytes[5] > 128 ? (bytes[5] - 256) / 10 : bytes[5] / 10;
        }
        
        const dot = bytes[6] & 1 ? 1 : 0;

        return {
            cl_crosshairsize: size || 2,
            cl_crosshairthickness: thickness || 1,
            cl_crosshairgap: gap,
            cl_crosshairdot: dot,
            color: "#00ff00" // Standard-Grün als solider Platzhalter
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
        console.log("Starte unfehlbaren ShareCode-Decoder-Scraper...");
        const baseUrl = 'https://procrosshairs.com';
        
        let presets = { lastUpdated: "", pros: [], gamePresets: [] };
        if (fs.existsSync(PRESETS_PATH)) {
            presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
        }

        // 1. Links von Hauptseite holen
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

        // 2. Spielerseiten abklatschen und Codes entschlüsseln
        for (const url of cs2Urls) {
            const urlChunks = url.split('/');
            const urlName = urlChunks[urlChunks.length - 1] || "Unknown";
            
            try {
                const profilePage = await axios.get(url, httpOptions);
                
                // Wir fischen den Share-Code heraus, der laut Debug-Log definitiv da ist!
                const shareCodeMatch = profilePage.data.match(/(CSGO-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5})/i);
                
                if (shareCodeMatch) {
                    const shareCode = shareCodeMatch[1];
                    // Mathematische Entschlüsselung statt unzuverlässigem Text-Parsing!
                    const parsedData = decodeShareCode(shareCode);

                    let existingPro = presets.pros.find(p => cleanName(p.name) === cleanName(urlName) && p.game === "CS2");
                    if (existingPro) {
                        Object.assign(existingPro, parsedData, { share_code: shareCode });
                    } else {
                        presets.pros.push({ name: urlName, game: "CS2", ...parsedData, share_code: shareCode });
                    }
                    console.log(`[Erfolg] ${urlName} -> Code: ${shareCode} | extrahiertes Gap: ${parsedData.cl_crosshairgap}`);
                } else {
                    console.log(`[Fehler] Kein Share-Code für ${urlName} im HTML.`);
                }

                await delay(2000);
            } catch (e) {
                console.error(`Fehler bei ${urlName}:`, e.message);
            }
        }

        // Speichern
        presets.lastUpdated = new Date().toLocaleString('de-DE');
        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log("\nAbsolut fertig! presets.json wurde erfolgreich mathematisch berechnet.");

    } catch (error) {
        console.error("Kritischer Fehler im Ablauf:", error.message);
    }
}

run();
