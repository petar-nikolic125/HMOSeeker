import cron from 'node-cron';
import { article4CacheService } from './article4-cache';

/**
 * Article 4 Cache Refresh Cron Job
 * Runs once per day at 3 AM to refresh the Article 4 area cache
 * This minimizes API calls while keeping data fresh
 */
export class Article4CronService {
  private cronJob: cron.ScheduledTask | null = null;

  /**
   * Start the cron job
   */
  start(): void {
    if (this.cronJob) {
      console.log('⚠️ Article 4 cron job is already running');
      return;
    }

    // Run every day at 3 AM (when traffic is low)
    this.cronJob = cron.schedule('0 3 * * *', async () => {
      console.log('🔄 Starting scheduled Article 4 cache refresh...');
      try {
        await article4CacheService.refreshCache();
        console.log('✅ Scheduled Article 4 cache refresh completed');
      } catch (error) {
        console.error('❌ Scheduled Article 4 cache refresh failed:', error);
      }
    });

    console.log('✅ Article 4 cache refresh cron job started (runs daily at 3 AM)');

    // Also do an initial refresh if cache doesn't exist or is stale
    this.initialRefresh();
  }

  /**
   * Perform initial cache refresh if needed
   */
  private async initialRefresh(): Promise<void> {
    try {
      const stats = await article4CacheService.getStats();
      
      // If cache is more than 24 hours old, refresh it
      if (stats.age_hours >= 24) {
        console.log(`🔄 Cache is ${stats.age_hours} hours old, refreshing...`);
        await article4CacheService.refreshCache();
      } else {
        console.log(`✅ Article 4 cache is fresh (${stats.age_hours} hours old, ${stats.article4Count} Article 4 areas)`);
      }
    } catch (error) {
      // If no cache exists, create it
      console.log('🔄 No cache found, creating initial cache...');
      try {
        await article4CacheService.refreshCache();
      } catch (refreshError) {
        console.error('❌ Failed to create initial cache:', refreshError);
      }
    }
  }

  /**
   * Stop the cron job
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('🛑 Article 4 cache refresh cron job stopped');
    }
  }

  /**
   * Manually trigger a cache refresh (for testing or admin purposes)
   */
  async manualRefresh(): Promise<void> {
    console.log('🔄 Manual Article 4 cache refresh triggered...');
    await article4CacheService.refreshCache();
  }
}

export const article4CronService = new Article4CronService();
