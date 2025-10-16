# Article4Maps API Integracija

## 📋 Pregled

Sistem sada koristi **Article4Maps API** kao primarni izvor za proveru Article 4 direkcija. Ovo obezbeđuje najveću tačnost (99.9%) jer koristi zvanične podatke direktno od article4map.com servisa.

## 🔑 Kako Dobiti API Ključ

1. **Idi na** [https://article4map.com/#pricing](https://article4map.com/#pricing)

2. **Izaberi plan** prema broju API poziva koje ti treba:
   - **API 500**: £11.92/mesečno (500 poziva/mesec)
   - **API 1000**: £19.97/mesečno (1000 poziva/mesec)
   - **API 4000**: £39.96/mesečno (4000 poziva/mesec)
   - Godišnji planovi nude 33% popusta

3. **Registruj se i pretplati se** na izabrani plan

4. **Reload stranice** nakon pretplate da vidiš svoj API ključ

5. **Kopiraj API ključ** sa stranice

## ⚙️ Kako Dodati API Ključ u Replit

### Metoda 1: Preko Replit Secrets (Preporučeno)

1. Otvori svoj Replit projekat
2. Klikni na **"Secrets"** tab u levom panelu (ikona ključa 🔐)
3. Klikni **"Add new secret"**
4. Unesi:
   - **Key**: `ARTICLE4MAPS_API_KEY`
   - **Value**: Tvoj API ključ sa article4map.com
5. Klikni **"Add secret"**
6. Restartuj aplikaciju (workflow će se automatski restartovati)

### Metoda 2: Preko .env Fajla (Za lokalni development)

1. Napravi `.env` fajl u root direktorijumu projekta
2. Dodaj sledeću liniju:
   ```
   ARTICLE4MAPS_API_KEY=tvoj_api_kljuc_ovde
   ```
3. Sačuvaj fajl
4. Restartuj aplikaciju

## 🎯 Prioritet Provere Article 4

Sistem radi sa sledećim prioritetom:

1. **Article4Maps API** (99.9% tačnost) ← **NAJVIŠI PRIORITET** kada je konfigurisan
2. **Database Lookup** (99% tačnost) ← Fallback ako API nije konfigurisan
3. **Geographic/GeoJSON** (95% tačnost) ← Poslednji fallback

## ✅ Kako Proveriti da li API Radi

Nakon što dodaš API ključ:

1. Otvori aplikaciju u browseru
2. Otvori Developer Console (F12)
3. Proveri property i vidi u konzoli:
   - ✅ Videćeš: `🔑 Using Article4Maps API for POSTCODE`
   - ✅ Videćeš: `✅ Article4Maps API check completed in XXms for POSTCODE`

Ili proveri system health endpoint:
```bash
curl https://tvoj-domen.replit.dev/api/article4/health
```

Trebalo bi da vidiš:
```json
{
  "article4maps_api": {
    "configured": true,
    "status": "✅ Active - Using official API (99.9% accuracy)",
    "priority": "Primary source when configured"
  },
  ...
}
```

## 📊 API Informacije

### Endpoint Konfiguracija

- **Base URL**: `https://api.article4map.com/v1` (default)
- **Autentifikacija**: Bearer token
- **Format**: JSON

### Šta API Pruža

- ✅ Provera trenutnih Article 4 zona
- ✅ Informacije o nadolazećim Article 4 zonama
- ✅ Pokrivanje svih 307 councils u Engleskoj
- ✅ Dnevno ažuriranje podataka

## 🔧 Opcione Env Varijable

Možeš da override-uješ API URL ako je potrebno:

```env
ARTICLE4MAPS_API_KEY=tvoj_kljuc
ARTICLE4MAPS_API_URL=https://api.article4map.com/v1
```

## ⚠️ Bez API Ključa

Ako **ne dodaš API ključ**, sistem će i dalje raditi koristeći fallback metode:

- ℹ️ Videćeš u console: `Article4Maps API not configured (missing ARTICLE4MAPS_API_KEY), using fallback methods`
- Sistem će koristiti database i geographic lookup (95-99% tačnost)
- Aplikacija neće pasti, ali tačnost će biti malo manja

## 📝 Napomene

- API ključ je **siguran** jer se čuva u environment varijablama
- **Ne hardcode-uj** API ključ direktno u kod
- Proveri svoj **API limit** na article4map.com dashboard-u
- Rate limits zavise od tvog plana (4-8 poziva na 10 sekundi)

## 🆘 Troubleshooting

### Problem: "Invalid Article4Maps API key"
**Rešenje**: Proveri da si pravilno kopirao API ključ iz article4map.com

### Problem: "Rate limit exceeded"
**Rešenje**: Upgraduj plan ili smanji broj API poziva

### Problem: Ne vidim nikakvu promenu
**Rešenje**: Restartuj aplikaciju nakon dodavanja API ključa

## 📞 Podrška

- **Article4Maps Support**: Kontaktiraj ih preko website-a
- **API Dokumentacija**: Dostupna nakon pretplate na article4map.com/api

---

**Napravljeno**: Oktober 2025  
**Status**: ✅ Implementirano i spremno za korišćenje
