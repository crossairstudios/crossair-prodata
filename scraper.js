async function run() {
    try {
        console.log("Starte Scraping...");
        const players = await scrapePlayer('https://totalcsgo.com/crosshairs');
        
        if (!players || players.length === 0) {
            console.error("Fehler: Keine Spieler gefunden! Prüfe die CSS-Selektoren.");
            return;
        }

        const outputPath = './presets.json';
        fs.writeFileSync(outputPath, JSON.stringify(players, null, 2));
        
        console.log(`Erfolg! Datei wurde aktualisiert unter: ${require('path').resolve(outputPath)}`);
    } catch (err) {
        console.error("Kritischer Fehler während des Workflows:", err);
    }
}
run();
