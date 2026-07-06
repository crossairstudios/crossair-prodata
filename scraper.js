const axios = require('axios');
const cheerio = require('cheerio');

const httpOptions = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
};

async function run() {
    try {
        console.log("--- ECHTER HTML-CHECK START ---");
        const baseUrl = 'https://procrosshairs.com';
        
        const response = await axios.get(baseUrl, httpOptions);
        const $ = cheerio.load(response.data);
        
        // 1. Welche Scripts gibt es überhaupt?
        console.log("\n--- Vorhandene Script-Tags ---");
        $('script').each((i, el) => {
            const src = $(el).attr('src');
            const id = $(el).attr('id');
            if (src) {
                console.log(`Script ${i}: src="${src}"`);
            } else if (id) {
                console.log(`Script ${i}: id="${id}"`);
            } else {
                const text = $(el).html() || "";
                console.log(`Script ${i}: Inlinescript (Länge: ${text.length} Zeichen)`);
                if (text.includes('player') || text.includes('crosshair')) {
                    console.log(`   -> Enthält verdächtigen Text: ${text.substring(0, 150)}...`);
                }
            }
        });

        // 2. Wie sehen die Spieler-Elemente im HTML aus?
        console.log("\n--- Suche nach Spieler-Karten/Elementen ---");
        // Wir suchen nach Links oder Elementen, die das Wort "player" im Text oder Attribut haben
        $('[class*="player"], [id*="player"], a').each((i, el) => {
            const text = $(el).text().trim();
            const attrs = el.attribs;
            
            if (text.toLowerCase().includes('donk') || text.toLowerCase().includes('zywoo')) {
                console.log(`Gefundenes Element für Pro-Spieler:`);
                console.log(`Tag: <${el.name}>, Text: "${text}"`);
                console.log(`Attribute:`, JSON.stringify(attrs, null, 2));
                console.log("-----------------------------------------");
            }
        });

    } catch (error) {
        console.error("Fehler beim HTML-Check:", error.message);
    }
}

run();
