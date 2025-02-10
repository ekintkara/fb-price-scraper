const fs = require("fs");
const CycleTLS = require("cycletls");
const cheerio = require("cheerio");
const axios = require("axios");
require("dotenv").config();

// Ufak bir yardımcı fonksiyon: 'ms' milisaniye bekle
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapePlayers() {
  try {
    console.log("Scraping process started.");
    // Uygulama açılır açılmaz 5 saniye bekle (cf-scraper konteyneri hazır olsun)
    console.log("cf-scraper'ın başlatılması için 5 saniye bekleniyor...");
    await delay(5000);

    console.log("Oyuncu listesi yükleniyor...");
    const players = JSON.parse(fs.readFileSync("players.json", "utf8"));
    console.log(`${players.length} oyuncu bulundu.`);

    for (const playerEndpoint of players) {
      try {
        const url = `${process.env.FUTBIN_BASE_URL}${playerEndpoint}`;
        console.log(`\nOyuncu sayfası taranıyor: ${url}`);

        // -- Session alma, retry ile --
        let session = null;
        const maxAttempts = 5; // Kaç kez tekrar deneyeceğiz
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            console.log(`Session request attempt ${attempt}/${maxAttempts}`);
            session = await fetch(process.env.CF_SCRAPER_ENDPOINT, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                url,
                mode: "waf-session",
              }),
            }).then((res) => res.json());

            // Başarılı yanıt alınmış mı?
            if (session && session.code === 200) {
              console.log("Session successfully obtained.");
              // Session başarıyla alındı, döngüden çık
              break;
            }

            // Hata durumları
            if (
              session &&
              session.code === 500 &&
              session.message &&
              session.message.includes("not ready")
            ) {
              console.log(
                `cf-scraper not ready (attempt ${attempt}/${maxAttempts}). 5sn bekleniyor...`
              );
              await delay(5000); // 5 saniye bekle
            } else {
              // "not ready" dışında bir hata veya farklı durum
              console.error("Beklenmeyen session hatası:", session);
              break;
            }
          } catch (err) {
            console.error("Session request hatası:", err);
            // Tekrar denemenin faydalı olup olmayacağı duruma göre karar verebilirsiniz.
            // Örnek olarak yine 5sn bekleyip tekrar deneyebilirsiniz:
            await delay(5000);
          }
        }

        if (!session || session.code !== 200) {
          console.error("Session alınamadı veya başarısız:", session);
          // Bu oyuncu için devam etmeyip bir sonraki oyuncuya geçebilirsiniz
          continue;
        }

        // ---- Session alınabildiyse asıl işlemlere devam ----
        console.log("Fetching player page with CycleTLS...");
        const cycleTLS = await CycleTLS();
        const response = await cycleTLS(
          url,
          {
            body: "",
            ja3: process.env.JA3_FINGERPRINT,
            userAgent: session.headers["user-agent"],
            headers: {
              ...session.headers,
              cookie: session.cookies
                .map((cookie) => `${cookie.name}=${cookie.value}`)
                .join("; "),
            },
          },
          "get"
        );
        console.log(`Sayfa yanıtı: ${response.status}`);
        cycleTLS.exit().catch((err) => {});

        if (response.status !== 200) {
          console.error("Sayfa yüklenemedi:", response.status);
          continue;
        }

        const html = response.body;
        const $ = cheerio.load(html);

        const results = {
          Source: "futbin",
          Data: [],
        };

        const playerCards = {};
        const cardCount = $(
          ".player-header-card-section.full-height.minus-margin-top-16 .player-card-wrapper"
        ).length;
        console.log(`\nBu futbolcu için ${cardCount} farklı kart bulundu.`);

        $(
          ".player-header-card-section.full-height.minus-margin-top-16 .player-card-wrapper"
        ).each((_, cardWrapper) => {
          const $cardWrapper = $(cardWrapper);
          const dataId = $cardWrapper.attr("data-id");

          const $playerImg = $cardWrapper
            .find('img[src*="/players/"]')
            .first();

          if ($playerImg.length > 0) {
            const imgSrc = $playerImg.attr("src");
            console.log(`Resim URL'si bulundu: ${imgSrc}`);

            const playerIdMatch = imgSrc.match(/\/players\/(?:p)?(\d+)\.png/);
            if (playerIdMatch && playerIdMatch[1]) {
              const playerExternalId = playerIdMatch[1];
              playerCards[dataId] = playerExternalId;
              console.log(
                `Kart bulundu - DataID: ${dataId}, PlayerExternalId: ${playerExternalId}`
              );
            } else {
              console.log(
                `Uyarı: ${imgSrc} URL'sinden playerExternalId çıkarılamadı`
              );
            }
          } else {
            console.log(
              `Uyarı: ${dataId} data-id'li kartta resim bulunamadı`
            );
          }
        });

        for (const [dataId, playerExternalId] of Object.entries(playerCards)) {
          console.log(`\n${playerExternalId} ID'li kart için fiyat verileri toplanıyor...`);

          const priceData = {
            PlayerExternalId: playerExternalId,
            ConsolePrice1: 0,
            ConsolePrice2: 0,
            ConsolePrice3: 0,
            ConsolePrice4: 0,
            ConsolePrice5: 0,
            ConsoleLastUpdated: "",
            PCPrice1: 0,
            PCPrice2: 0,
            PCPrice3: 0,
            PCPrice4: 0,
            PCPrice5: 0,
            PCLastUpdated: "",
          };

          $(`.player-header-prices-section [data-id="${dataId}"]`).each(
            (_, priceBlock) => {
              const $block = $(priceBlock);
              const isPCBlock = $block.find('img[srcset*="pc_blue"]').length > 0;
              const prefix = isPCBlock ? "PC" : "Console";

              console.log(`Fiyat bloğu işleniyor (${prefix})`);

              const $firstPrice = $block.find(
                "div.column > div.price.inline-with-icon.lowest-price-1"
              );
              if ($firstPrice.length > 0) {
                const firstPriceText = $firstPrice
                  .clone()
                  .children()
                  .remove()
                  .end()
                  .text()
                  .trim();
                const firstPriceValue = parseInt(
                  firstPriceText.replace(/,/g, "")
                );
                if (!isNaN(firstPriceValue)) {
                  priceData[`${prefix}Price1`] = firstPriceValue;
                  console.log(`${prefix} için ilk fiyat:`, firstPriceValue);
                }
              }

              const $otherPrices = $block.find(
                ".lowest-prices-wrapper .lowest-price.inline-with-icon"
              );
              $otherPrices.each((index, element) => {
                const $price = $(element);
                const priceText = $price
                  .clone()
                  .children()
                  .remove()
                  .end()
                  .text()
                  .trim();
                const priceValue = parseInt(priceText.replace(/,/g, ""));
                if (!isNaN(priceValue)) {
                  priceData[`${prefix}Price${index + 2}`] = priceValue;
                  console.log(
                    `${prefix} için ${index + 2}. fiyat:`,
                    priceValue
                  );
                }
              });

              const $lastUpdated = $block.find(
                ".prices-updated.no-wrap.inline-with-icon.text-faded"
              );
              if ($lastUpdated.length > 0) {
                const lastUpdatedText = $lastUpdated.text().trim();
                const timeMatch = lastUpdatedText.match(/Price Updated: (.+)/);
                if (timeMatch && timeMatch[1]) {
                  priceData[`${prefix}LastUpdated`] = timeMatch[1].trim();
                  console.log(
                    `${prefix} için son güncelleme:`,
                    timeMatch[1].trim()
                  );
                }
              }
            }
          );

          results.Data.push(priceData);
        }

        if (results.Data.length > 0) {
          try {
            console.log(`\nToplam ${results.Data.length} kartın verileri API'ye gönderiliyor...`);
            console.log(results);

            const apiResponse = await axios.post(
              process.env.API_ENDPOINT,
              results
            );
            console.log(
              `Veriler başarıyla gönderildi. API yanıtı: ${apiResponse.status}`
            );
          } catch (apiError) {
            console.error("API hatası:", apiError.message);
          }
        } else {
          console.log("Bu futbolcu için fiyat verisi bulunamadı.");
        }

        // Bir oyuncu bitti, RATE_LIMIT_MS kadar bekle
        await new Promise((resolve) =>
          setTimeout(resolve, parseInt(process.env.RATE_LIMIT_MS))
        );
      } catch (playerError) {
        console.error("Oyuncu işleme hatası:", playerError);
        continue;
      }
    }
  } catch (error) {
    console.error("\nGenel hata oluştu:", error);
  }
  console.log("Scraping process completed.");
}

scrapePlayers();
