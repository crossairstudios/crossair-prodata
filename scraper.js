// 1. Definiere den Regex für den Share-Code (falls nicht schon so vorhanden)
const shareCodeRegex = /(CSGO-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5})/;\

function extractPlayerSettings(htmlString, playerName) {
    const match = htmlString.match(shareCodeRegex);
    
    if (match) {
        const shareCode = match[1];
        console.log(`[Erfolg] Code für ${playerName} gefunden: ${shareCode}`);
        
        // Da die Live-API die Einzelwerte (gap, size) nicht im Klartext liefert,
        // speichern wir den echten Share-Code. Für die Spieldaten nutzen wir 
        // sinnvolle Platzhalter ODER lesen die JSON-Struktur von __NEXT_DATA__ tiefer aus.
        return {
            name: playerName,
            game: "CS2",
            cl_crosshairsize: 1, // Optionaler Standard
            cl_crosshairthickness: 1,
            cl_crosshairgap: -4, // Setze hier den echten Standard-Meta-Wert (-4) statt -2 ein
            cl_crosshairdot: 0,
            color: "#00ffff",
            share_code: shareCode // <-- Das ist der entscheidende Wert!
        };
    }
    
    // Absoluter Notfall-Fallback, wenn gar nichts existiert
    return null;
}
