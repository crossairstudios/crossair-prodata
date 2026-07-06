// scraper.js (Auszug für den Extraktions-Teil)
async function scrapePlayer(url) {
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    // 1. Logik-Werte (für "Anwenden"-Button)
    const crosshairData = {
        cl_crosshairsize: parseFloat($('input[name="cl_crosshairsize"]').val()),
        cl_crosshairthickness: parseFloat($('input[name="cl_crosshairthickness"]').val()),
        cl_crosshairgap: parseFloat($('input[name="cl_crosshairgap"]').val()),
        cl_crosshairdot: parseInt($('input[name="cl_crosshairdot"]').val()),
        // ... weitere Werte
    };

    // 2. Visuelle URL (für die Vorschau-Kachel)
    // Wir suchen das Bild, das die Vorschau auf der Website darstellt
    const imageUrl = $('img.crosshair-preview-image').attr('src') || null;

    return { ...crosshairData, image_url: imageUrl };
}
