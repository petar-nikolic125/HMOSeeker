import { ScraperManager } from "./scraper-manager";

/**
 * Bulk Scraper - popunjava cache za sve UK gradove
 */
export class BulkScraper {
  
  // Lista glavnih UK gradova za scraping
  private static readonly UK_CITIES = [
    "London", "Birmingham", "Manchester", "Liverpool", "Leeds", "Sheffield", 
    "Bristol", "Newcastle", "Nottingham", "Leicester", "Portsmouth", "Southampton",
    "Brighton", "Hull", "Plymouth", "Stoke", "Wolverhampton", "Derby",
    "Swansea", "Cardiff", "Belfast", "Glasgow", "Edinburgh", "Aberdeen",
    "Coventry", "Bradford", "Sunderland", "Bournemouth", "Norwich", "Middlesbrough",
    "Swindon", "Crawley", "Ipswich", "Wigan", "Croydon", "Walsall",
    "Mansfield", "Oxford", "Warrington", "Slough", "Peterborough", "Cambridge"
  ];

  private static isRunning = false;
  private static progress = {
    current: 0,
    total: 0,
    currentCity: '',
    status: 'idle' as 'idle' | 'running' | 'completed' | 'failed'
  };

  /**
   * Pokreće bulk scraping za sve gradove
   */
  static async startBulkScrape(): Promise<void> {
    if (this.isRunning) {
      throw new Error("Bulk scraping is already running");
    }

    this.isRunning = true;
    this.progress = {
      current: 0,
      total: this.UK_CITIES.length,
      currentCity: '',
      status: 'running'
    };

    console.log(`🚀 Starting bulk scrape for ${this.UK_CITIES.length} UK cities...`);

    try {
      for (let i = 0; i < this.UK_CITIES.length; i++) {
        const city = this.UK_CITIES[i];
        this.progress.current = i + 1;
        this.progress.currentCity = city;

        console.log(`📍 [${i + 1}/${this.UK_CITIES.length}] Scraping ${city}...`);

        try {
          // Scrapuj svaki grad sa standardnim parametrima
          await ScraperManager.searchProperties({
            city: city,
            min_bedrooms: 1,
            max_price: 1500000,
            refresh: false // Ne forsiraj refresh - koristi cache ako postoji
          });

          console.log(`✅ ${city} completed successfully`);
          
          // Kratka pauza između gradova da ne overloadujem servise
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (cityError) {
          console.error(`❌ Failed to scrape ${city}:`, cityError);
          // Nastavi sa sledećim gradom umesto da prekineš ceo proces
          continue;
        }
      }

      this.progress.status = 'completed';
      console.log("🎉 Bulk scraping completed successfully!");
      
    } catch (error) {
      this.progress.status = 'failed';
      console.error("💥 Bulk scraping failed:", error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Vraća trenutni status bulk scrapinga
   */
  static getProgress() {
    return {
      ...this.progress,
      isRunning: this.isRunning
    };
  }

  /**
   * Zaustavlja bulk scraping (gracefully)
   */
  static stop() {
    if (this.isRunning) {
      console.log("🛑 Stopping bulk scraper...");
      this.isRunning = false;
      this.progress.status = 'idle';
    }
  }

  /**
   * Lista gradova koji će se scrapovati
   */
  static getCityList() {
    return [...this.UK_CITIES];
  }
}