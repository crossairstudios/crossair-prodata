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

function cleanName(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
    try {
        console.log("Starte Astro-Script-Data-Extractor...");
        const baseUrl = 'https://procrosshairs.com';
        
        let presets = { lastUpdated: "", pros: [], gamePresets: [] };
        if (fs.existsSync(PRESETS_PATH)) {
            presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
        }

        const mainPage = await axios.get(baseUrl, httpOptions);
        const $ = cheerio.load(mainPage.data);
        
        let rawDataText = "";

        // Wir durchsuchen alle Inline-Scripts auf der Startseite nach dem Datenblock
        $('script').each((i, el) => {
            const text = $(el).html() || "";
            // Häufig verstecken sich die Daten in einem großen Array/Objekt
            if (!$(el).attr('src') && (text.includes('NiKo') || text.includes('donk'))) {
                rawDataText = text;
                console.log(`Verdächtiges Inline-Script gefunden! Länge: ${text.length} Zeichen.`);
            }
        });

        if (!rawDataText) {
            console.log("Kritischer Fehler: Konnte das Daten-Script mit den Spielernamen nicht im HTML finden.");
            return;
        }

        // Wir extrahieren alle JSON-ähnlichen Strukturen oder Objekte aus dem Script via Regex.
        // Astro lagert Daten oft in kompakten Objekten ab. Wir extrahieren gezielt Blöcke, die wie Spieler aussehen.
        // Ein typischer Block enthält Namen und Sharecode: {name: "NiKo", ...} oder ["NiKo", ...]
        
        // Da wir wissen, dass NiKo auf der Seite ist, suchen wir nach seiner Datenumgebung, um das Format zu verstehen.
        const nikoIndex = rawDataText.indexOf('NiKo');
        console.log("\n--- Vorschau der Datenstruktur rund um 'NiKo' ---");
        console.log(rawDataText.substring(Math.max(0, nikoIndex - 300), Math.min(rawDataText.length, nikoIndex + 700)));
        console.log("------------------------------------------------\n");

        // Da wir jetzt flexibel parsen wollen, suchen wir nach allen Vorkommen von CSGO-Codes im Skript
        // und versuchen, den Namen davor oder danach zu matchen.
        const globalRegex = /\{[^{}]*?"crosshair_code"[^{}]*?\}/g; 
        // Falls die Keys unzitiert sind (reines JS-Objekt statt JSON):
        const jsObjectRegex = /\{[^{}]*?crosshair_code:[^{}]*?\}/g;

        const matches = rawDataText.match(globalRegex) || rawDataText.match(jsObjectRegex) || [];
        console.log(`Mögliche Spieler-Objekte im Script gefunden: ${matches.length}`);

        // Falls wir direkt strukturierte Objekte finden, parsen wir sie hier
        if (matches.length > 0) {
            matches.forEach(objStr => {
                try {
                    // Fix für unzitierte JS-Keys, falls nötig, um es in JSON zu verwandeln
                    const cleanJsonStr = objStr
                        .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":') // Keys zitieren
                        .replace(/'/g, '"'); // Single Quotes zu Double Quotes
                    
                    const p = JSON.parse(cleanJsonStr);
                    const name = p.name || p.slug;
                    const shareCode = p.crosshair_code || p.code;
                    
                    if (name && shareCode) {
                        // Wenn die Werte direkt als Zahlen im Objekt liegen:
                        const parsedData = {
                            cl_crosshairsize: p.size !== undefined ? parseFloat(p.size) : (p.cl_crosshairsize !== undefined ? parseFloat(p.cl_crosshairsize) : 2),
                            cl_crosshairthickness: p.thickness !== undefined ? parseFloat(p.thickness) : (p.cl_crosshairthickness !== undefined ? parseFloat(p.cl_crosshairthickness) : 1),
                            cl_crosshairgap: p.gap !== undefined ? parseFloat(p.gap) : (p.cl_crosshairgap !== undefined ? parseFloat(p.cl_crosshairgap) : -2),
                            cl_crosshairdot: p.dot ? 1 : 0,
                            color: rgbToHex(p.color_r, p.color_g, p.color_b)
                        };

                        let existingPro = presets.pros.find(ex => cleanName(ex.name) === cleanName(name) && ex.game === "CS2");
                        if (existingPro) {
                            Object.assign(existingPro, parsedData, { share_code: shareCode });
                        } else {
                            presets.pros.push({ name, game: "CS2", ...parsedData, share_code: shareCode });
                        }
                        console.log(`[Gefunden] ${name} -> Gap: ${parsedData.cl_crosshairgap}, Code: ${shareCode}`);
                    }
                } catch (e) {
                    // Ignorieren falls ein Block kein valides JSON war
                }
            });
        }

        // Speichern
        presets.lastUpdated = new Date().toLocaleString('de-DE');
        fs.writeFileSync(PRESETS_PATH, JSON.stringify(presets, null, 2), 'utf8');
        console.log("\nScan abgeschlossen.");

    } catch (error) {
        console.error("Fehler:", error.message);
    }
}

run();
