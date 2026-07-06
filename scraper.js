async function scrapePage(browser, url, gameName, limit = 30) {
    console.log(`Lade ${gameName} von: ${url}`);
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36");
    
    await page.goto(url, { waitUntil: 'networkidle2' });
    // Nach dem goto:
    console.log("Seiten-Titel:", await page.title());
    const html = await page.evaluate(() => document.body.innerHTML);
    console.log("HTML-Auszug:", html.substring(0, 500)); // Zeigt uns die ersten 500 Zeichen des Body

    // DEBUG: Falls leer, HTML ausgeben
    const content = await page.content();
    if (!content.includes('role="button"')) {
        console.warn(`Warnung: Keine Button-Elemente auf ${gameName} gefunden!`);
    }

    const data = await page.evaluate((limit, gameName) => {
        // Möglicherweise nutzen sie hier eine andere Klasse oder Struktur
        const items = document.querySelectorAll('li[role="button"]');
        const players = [];
        items.forEach((item) => {
            if (players.length >= limit) return;
            const name = item.querySelector('h2 a')?.innerText.trim();
            const img = item.querySelector('img');
            const altText = img?.getAttribute('alt') || "";
            const code = altText.split(': ')[1] || "";
            if (name && img?.src && code) {
                players.push({ name, imageUrl: img.src, code, game: gameName });
            }
        });
        return players;
    }, limit, gameName);

    await page.close();
    return data;
}
