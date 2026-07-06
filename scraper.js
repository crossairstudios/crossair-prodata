const axios = require('axios');
const fs = require('fs');

const httpOptions = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'de,en-US;q=0.7,en;q=0.3'
    }
};

async function run() {
    try {
        console.log("--- DEBUG DOWNLOAD START ---");
        const donkUrl = 'https://procrosshairs.com/player/76561198386265483/donk';
        
        console.log(`Lade rohes HTML für donk von: ${donkUrl}`);
        const response = await axios.get(donkUrl, httpOptions);
        
        // Wir speichern das, was axios sieht, in eine lokale Datei
        fs.writeFileSync('debug_donk.html', response.data, 'utf8');
        console.log("Erfolgreich! Die Datei 'debug_donk.html' wurde im selben Ordner erstellt.");
        
        // Kurzer Vorab-Check im Log
        console.log(`HTML-Länge: ${response.data.length} Zeichen.`);
        console.log("Enthält das Wort 'cl_crosshair'? ", response.data.includes('cl_crosshair'));
        console.log("Enthält das Wort 'CSGO-'? ", response.data.includes('CSGO-'));

    } catch (error) {
        console.error("Fehler beim Download:", error.message);
    }
}

run();
