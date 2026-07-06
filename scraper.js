const axios = require('axios');
const cheerio = require('cheerio');

const httpOptions = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
};

async function run() {
    try {
        console.log("--- STRUKTUR-ANALYSE START ---");
        const baseUrl = 'https://procrosshairs.com';
        
        const responseCS2 = await axios.get(baseUrl, httpOptions);
        const $cs2 = cheerio.load(responseCS2.data);
        
        const nextDataText = $cs2('#__NEXT_DATA__').html();
        if (!nextDataText) {
            console.log("Fehler: Kein __NEXT_DATA__ Element gefunden.");
            return;
        }

        const nextData = JSON.parse(nextDataText);
        const pageProps = nextData.props?.pageProps || {};
        
        const playersList = pageProps.players || pageProps.initialPlayers || Object.values(pageProps).find(val => Array.isArray(val)) || [];
        
        console.log(`\nGesamtanzahl gefundener Spieler im JSON: ${playersList.length}`);
        
        if (playersList.length > 0) {
            // Wir suchen gezielt nach ZywOo oder nehmen den ersten Eintrag
            const testPlayer = playersList.find(p => p?.name?.toLowerCase().includes('zywoo')) || playersList[0];
            
            console.log("\n================ ECHTE SPIELER-STRUKTUR IM HINTERGRUND ================");
            console.log(JSON.stringify(testPlayer, null, 2));
            console.log("=======================================================================\n");
        } else {
            console.log("Keine Spieler-Arrays in pageProps gefunden.");
            console.log("Verfügbare Keys in pageProps:", Object.keys(pageProps));
        }

    } catch (error) {
        console.error("Fehler während der Analyse:", error.message);
    }
}

run();
