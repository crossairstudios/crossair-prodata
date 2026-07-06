const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const PRESETS_PATH = path.join(__dirname, 'presets.json');

const shareCodeRegex = /(CSGO-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5})/i;

const httpOptions = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
};

async function run() {
    try {
        const baseUrl = 'https://procrosshairs.com';
        // Wir testen gezielt nur mit der Seite von donk, um die Struktur zu sehen!
        const testUrl = `${baseUrl}/player/donk`; 
        
        console.log(`--- DIAGNOSE START FÜR: donk ---`);
        const response = await axios.get(testUrl, httpOptions);
        const $p = cheerio.load(response.data);
        
        const nextDataRaw = $p('#__NEXT_DATA__').html();
        if (!nextDataRaw) {
            console.log("FEHLER: Kein __NEXT_DATA__ Element im HTML gefunden!");
            return;
        }

        const nextData = JSON.parse(nextDataRaw);
        const player = nextData.props?.pageProps?.player;
        
        if (!player) {
            console.log("FEHLER: 'player' Objekt existiert nicht in pageProps. Verfügbare Keys in pageProps:", Object.keys(nextData.props?.pageProps || {}));
        } else {
            console.log("\n================ ERFOLG! GEFUNDENE PLAYER-STRUKTUR ================");
            console.log(JSON.stringify(player, null, 2));
            console.log("===================================================================\n");
        }
        
        // Zeigt uns auch an, ob der Share-Code im rohen HTML auffindbar ist
        const rawMatch = response.data.match(shareCodeRegex);
        console.log("Roher HTML Share-Code Match:", rawMatch ? rawMatch[0] : "Nicht gefunden");

    } catch (err) {
        console.error("Kritischer Fehler während der Diagnose:", err.message);
    }
}

run();
