# HMO Hunter - Automatski Python Setup

## Šta je urađeno

Sistem sada automatski proverava i instalira potrebne Python biblioteke svaki put kada se pokrene. Ne trebaš više ručno da instaliraš `requests` i `beautifulsoup4`.

## Kako funkcioniše

1. **Na startup servera**: Kada se pokrene `npm run dev`, server automatski proverava Python biblioteke
2. **Pre pokretanja scrapera**: Svaki put kada se pokrene property scraper, sistem proverava biblioteke
3. **Automatska instalacija**: Ako biblioteke nisu instalirane, automatski se instaliraju

## Fajlovi koji omogućavaju ovo

- `server/services/python-setup.ts` - Glavni setup sistem
- `server/index.ts` - Startup check na pokretanje servera  
- `server/services/scraper-manager.ts` - Check pre pokretanja scrapera
- `setup-python.sh` - Bash script za manuelnu instalaciju ako je potrebna

## Kako testirati

Pokreni `npm run dev` - trebalo bi da vidiš u konzoli:
```
🚀 Pokretam HMO Hunter server...
🔧 Proveravam Python biblioteke...
✅ Python biblioteke su već instalirane
```

## Za buduće importove

Ovaj sistem će se automatski pokrenuti svaki put kada importuješ projekat u novi Replit environment.