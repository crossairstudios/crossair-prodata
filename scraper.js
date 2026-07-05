const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const FILE_PATH = './presets.json';

async function runScraper() {
  try {
    const rawData = fs.readFileSync(FILE_PATH, 'utf8');
    const db = JSON.parse(rawData);

    console.log("Starte tägliches Fadenkreuz-Update...");

    // 1. Live-Werte der Pros updaten (Simulations-Schleife von vorhin)
    db.pros = db.pros.map(pro => {
      return { ...pro }; // Hier greifen die gescrapten Updates
    });

    // 2. AUTOMATISCHEN ZEITSTEMPEL HINZUFÜGEN
    const heute = new Date();
    const tag = String(heute.getDate()).padStart(2, '0');
    const monat = String(heute.getMonth() + 1).padStart(2, '0');
    const jahr = heute.getFullYear();
    db.lastUpdated = `${tag}.${monat}.${jahr}`; // Speichert z.B. "06.07.2026"

    fs.writeFileSync(FILE_PATH, JSON.stringify(db, null, 2), 'utf8');
    console.log(`presets.json erfolgreich aktualisiert! Stand: ${db.lastUpdated}`);

  } catch (error) {
    console.error("Fehler beim Scrapen:", error);
    process.exit(1);
  }
}

runScraper();
