# Article 4 London Postcode Bulk Check

## 📋 Opis

Ova skripta proverava **sve London postkodove** (179 oblasti) pomoću Article4Maps API-ja i čuva rezultate u JSON fajl.

## 🚀 Kako pokrenuti

```bash
tsx scripts/check-all-london-postcodes.ts
```

## ⏱️ Trajanje

- **Ukupno postkodova**: 179
- **Delay između poziva**: 1.5 sekunde
- **Procenjeno vreme**: ~4-5 minuta

## 📊 Šta skripta radi

1. Proverava sve London postcode oblasti (E1-E20, N1-N22, NW1-NW11, SE1-SE28, SW1-SW20, W1-W14, WC1-WC2, EC1-EC4)
2. Za svaki postcode proverava:
   - Da li ima **trenutni** Article 4 (`current`)
   - Da li ima **nadolazeći** Article 4 (`upcoming`)
   - Status (npr. "active" ili datum kada počinje)
   - Razrešena adresa (resolved address)
3. Čuva rezultate u `cache/article4-london-postcodes.json`
4. Prikazuje detaljnu statistiku po oblastima

## 📁 Rezultati

Rezultati se čuvaju u `cache/article4-london-postcodes.json` u formatu:

```json
[
  {
    "postcode": "E1",
    "area": "E",
    "hasArticle4Current": true,
    "hasArticle4Upcoming": false,
    "currentStatus": "active",
    "resolvedAddress": "E1, London, Greater London, England, United Kingdom"
  },
  {
    "postcode": "N14",
    "area": "N",
    "hasArticle4Current": false,
    "hasArticle4Upcoming": false
  }
]
```

## 📈 Izlazni format

Za svaki postcode dobićeš:
- `postcode`: Kod oblasti (npr. "E1", "SW1A")
- `area`: Glavni region (E, EC, N, NW, SE, SW, W, WC)
- `hasArticle4Current`: Da li trenutno ima Article 4
- `hasArticle4Upcoming`: Da li je najavljeno Article 4
- `currentStatus`: Status trenutnog Article 4 (npr. "active")
- `upcomingStatus`: Datum ili status nadolazećeg Article 4
- `resolvedAddress`: Puna adresa
- `error`: Poruka greške (ako je bilo problema)

## 📊 Statistika na kraju

Skripta prikazuje:
1. **Ukupan broj postkodova** proverenih
2. **Broj sa trenutnim Article 4** - области pod restrikcijom
3. **Broj sa nadolazećim Article 4** - области koje će biti restriktovane
4. **Listu svih oblasti sa Article 4** - detaljan pregled
5. **Statistiku po regionima** - E, N, NW, SE, SW, W, WC, EC

## ⚠️ Napomene

### Rate Limiting
- API ima limit koliko puta može biti pozvan u minuti
- Skripta automatski čeka 5 sekundi ako detektuje rate limit
- Delay između poziva je 1.5 sekundi da spreči rate limiting

### API Ključ
- Ključ mora biti postavljen u `ARTICLE4MAPS_API_KEY` environment variable
- Već je postavljen u Replit Secrets
- Skripta automatski proverava da li je ključ dostupan

## 🔄 Kako koristiti rezultate

Nakon što skripta završi, možeš:

1. **Učitati rezultate u aplikaciju**:
```typescript
import results from './cache/article4-london-postcodes.json';

const article4Postcodes = results.filter(r => r.hasArticle4Current);
console.log(`Article 4 oblasti: ${article4Postcodes.length}`);
```

2. **Filtrirati nekretnine** po oblasti:
```typescript
function isInArticle4Area(postcode: string): boolean {
  const district = postcode.split(' ')[0]; // "E1 4AA" -> "E1"
  const result = results.find(r => r.postcode === district);
  return result?.hasArticle4Current || false;
}
```

3. **Prikazati na mapi** oblasti sa/bez Article 4

## 💡 Primer rezultata

```
📊 STATISTIKA:
   Ukupno postkodova: 179
   ✅ Sa trenutnim Article 4: 67
   ⏰ Sa nadolazećim Article 4: 12
   ❌ Greške: 0

🔴 POSTKODOVI SA TRENUTNIM ARTICLE 4:
   E1 (E): active
   E2 (E): active
   E3 (E): active
   ...

📍 PO OBLASTIMA:
   E   : 20 postkodova | 🔴 15 trenutni, 🟡 2 nadolazeći
   EC  : 27 postkodova | 🔴 0 trenutni, 🟡 0 nadolazeći
   N   : 24 postkodova | 🔴 18 trenutni, 🟡 3 nadolazeći
   ...
```

## 🔧 Podešavanja

Možeš promeniti:
- **Delay između poziva**: `delayBetweenCalls` (trenutno 1500ms)
- **Izlazni fajl**: `outputPath` (trenutno `cache/article4-london-postcodes.json`)
- **Liste postkodova**: `LONDON_POSTCODES` objekat na vrhu fajla

## 📞 Pomoć

Ako imaš problema:
1. Proveri da li je `ARTICLE4MAPS_API_KEY` postavljen
2. Proveri da li ima dovoljno API kredita
3. Proveri `cache/article4-london-postcodes.json` za delimične rezultate
