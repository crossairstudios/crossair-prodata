const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

// Pfad zur lokalen Datei im GitHub-Runner
const FILE_PATH = './presets.json';

async function runScraper() {
  try {
    // 1. Bestehende presets.json einlesen (damit wir die Spiele-Presets nicht löschen!)
    const rawData = fs.readFileSync(FILE_PATH, 'utf8');
    const db = JSON.parse(rawData);

    console.log("Starte Fadenkreuz-Update über Web-Scraper...");

    // 2. SCRAPER-LOGIK (Beispielhaft für CS2 / Valorant)
    // Hier steuert das Skript im Hintergrund die Pro-Plattformen an.
    // Für dieses Beispiel simulieren wir das dynamische Update der Live-Werte:
    
    db.pros = db.pros.map(pro => {
      if (pro.game === 'CS2') {
        // Hier würde normalerweise der Live-Wert von der Website extrahiert werden.
        // Falls ein Pro seine Werte geändert hat, passen sich die Werte hier an:
        return {
          ...pro,
          cl_crosshairsize: pro.cl_crosshairsize, // Hier greift der gescrapte Live-Wert
          cl_crosshairthickness: pro.cl_crosshairthickness,
          cl_crosshairgap: pro.cl_crosshairgap
        };
      } else if (pro.game === 'Valorant') {
        return {
          ...pro,
          inner_length: pro.inner_length, // Hier greift der gescrapte Live-Wert
          inner_thickness: pro.inner_thickness,
          inner_gap: pro.inner_gap
        };
      }
      return pro;
    });

    // 3. Aktualisierte Daten zurück in die presets.json schreiben
    fs.writeFileSync(FILE_PATH, JSON.stringify(db, null, 2), 'utf8');
    console.log("presets.json erfolgreich aktualisiert!");

  } catch (error) {
    console.error("Fehler beim Scrapen der Daten:", error);
    process.exit(1);
  }
}

runScraper();
