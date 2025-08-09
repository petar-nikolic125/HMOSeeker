import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

/**
 * Automatski setup Python biblioteka koji se pokreće jednom prilikom pokretanja servera
 */
export class PythonSetup {
  private static setupComplete = false;
  private static setupPromise: Promise<void> | null = null;

  static async ensurePythonDependencies(): Promise<void> {
    // Ako je setup već završen, ne radi ništa
    if (this.setupComplete) {
      return;
    }

    // Ako je setup u toku, čekaj da se završi
    if (this.setupPromise) {
      return this.setupPromise;
    }

    // Pokreni setup
    this.setupPromise = this.performSetup();
    return this.setupPromise;
  }

  private static async performSetup(): Promise<void> {
    console.log('🔧 Proveravam Python biblioteke...');

    try {
      // Proveri da li su biblioteke instalirane
      await execAsync('python3 -c "import requests, bs4" 2>/dev/null');
      console.log('✅ Python biblioteke su već instalirane');
      this.setupComplete = true;
      return;
    } catch (error) {
      console.log('📦 Instaliram potrebne Python biblioteke...');
      
      try {
        // Pokušaj sa uv prvo
        await execAsync('uv add requests beautifulsoup4 lxml');
        console.log('✅ Python biblioteke uspešno instalirane pomoću uv');
      } catch (uvError) {
        try {
          // Fallback na pip
          await execAsync('pip install requests beautifulsoup4 lxml');
          console.log('✅ Python biblioteke uspešno instalirane pomoću pip');
        } catch (pipError) {
          console.error('❌ Greška pri instalaciji Python biblioteka:', pipError);
          throw pipError;
        }
      }
    }

    this.setupComplete = true;
    console.log('🚀 Python setup završen!');
  }

  /**
   * Proverava da li su potrebne biblioteke dostupne
   */
  static async checkDependencies(): Promise<boolean> {
    try {
      await execAsync('python3 -c "import requests, bs4"');
      return true;
    } catch {
      return false;
    }
  }
}