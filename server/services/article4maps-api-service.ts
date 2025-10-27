interface Article4MapsApiResponse {
  inArticle4: boolean;
  status: string;
  areas: Array<{
    name: string;
    council: string;
    reference: string;
  }>;
  confidence: number;
  source: string;
  postcode?: string;
}

/**
 * Article4Maps.com API Service
 * Official API integration for checking Article 4 directions
 * 
 * Setup:
 * 1. Subscribe to Article4Maps API at https://article4map.com/#pricing
 * 2. Get your API key after subscribing
 * 3. Add ARTICLE4MAPS_API_KEY to your environment variables
 */
export class Article4MapsApiService {
  private readonly apiKey: string | undefined;
  private readonly apiBaseUrl: string;
  
  constructor() {
    this.apiKey = process.env.ARTICLE4MAPS_API_KEY;
    this.apiBaseUrl = process.env.ARTICLE4MAPS_API_URL || 'https://api.article4map.com';
    
    // Debug log - prikaži da li je API ključ učitan
    console.log('🔍 Environment:', process.env.NODE_ENV);
    console.log('🔍 All env keys:', Object.keys(process.env).filter(k => k.includes('ARTICLE')));
    
    if (this.apiKey) {
      console.log(`🔑 Article4Maps API key configured: ${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`);
    } else {
      console.warn('⚠️ Article4Maps API key NOT configured in production!');
      console.warn('⚠️ Check Deployment Secrets, not just Replit IDE Secrets');
    }
  }

  /**
   * Check if the API is configured and available
   */
  public isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Check Article 4 status using the official Article4Maps API
   */
  public async checkArticle4(postcode: string): Promise<Article4MapsApiResponse> {
    if (!this.isConfigured()) {
      throw new Error('Article4Maps API key not configured. Please add ARTICLE4MAPS_API_KEY to environment variables.');
    }

    try {
      const cleanPostcode = postcode.replace(/\s/g, '').toUpperCase();
      
      // Article4Maps API uses POST /text endpoint with JSON body
      const response = await fetch(`${this.apiBaseUrl}/text`, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          search: cleanPostcode,
          type: 'all'
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid Article4Maps API key. Please check your ARTICLE4MAPS_API_KEY environment variable.');
        }
        if (response.status === 429) {
          throw new Error('Article4Maps API rate limit exceeded. Please check your subscription plan.');
        }
        throw new Error(`Article4Maps API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return this.transformApiResponse(data, cleanPostcode);
      
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ Article4Maps API error:', error.message);
        throw error;
      }
      throw new Error('Unknown error occurred while checking Article4Maps API');
    }
  }

  /**
   * Batch check multiple postcodes
   */
  public async checkMultiple(postcodes: string[]): Promise<Article4MapsApiResponse[]> {
    if (!this.isConfigured()) {
      throw new Error('Article4Maps API key not configured');
    }

    try {
      const cleanPostcodes = postcodes.map(p => p.replace(/\s/g, '').toUpperCase());
      
      // Check each postcode individually since batch endpoint may not be available
      const results = await Promise.all(
        cleanPostcodes.map(postcode => this.checkArticle4(postcode))
      );
      
      return results;
    } catch (error) {
      console.error('❌ Article4Maps batch check error:', error);
      throw error;
    }
  }

  // Old implementation commented out - batch endpoint may not exist
  private async checkMultiple_OLD(postcodes: string[]): Promise<Article4MapsApiResponse[]> {
    if (!this.isConfigured()) {
      throw new Error('Article4Maps API key not configured');
    }

    try {
      const cleanPostcodes = postcodes.map(p => p.replace(/\s/g, '').toUpperCase());
      
      const response = await fetch(`${this.apiBaseUrl}/batch`, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postcodes: cleanPostcodes,
          include_upcoming: true
        })
      });

      if (!response.ok) {
        throw new Error(`Article4Maps API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (Array.isArray(data.results)) {
        return data.results.map((result: any, index: number) => 
          this.transformApiResponse(result, cleanPostcodes[index])
        );
      }
      
      return [];
      
    } catch (error) {
      console.error('❌ Article4Maps batch API error:', error);
      throw error;
    }
  }

  /**
   * Transform API response to our internal format
   */
  private transformApiResponse(data: any, postcode: string): Article4MapsApiResponse {
    // Handle array response from /text endpoint
    if (Array.isArray(data)) {
      const currentArticle4 = data.find(item => item.type === 'current' && item.status === 'active');
      const upcomingArticle4 = data.find(item => item.type === 'upcoming');
      
      const inArticle4 = !!currentArticle4;
      const areas: Array<{ name: string; council: string; reference: string }> = [];
      
      if (currentArticle4) {
        areas.push({
          name: currentArticle4.resolvedaddress || 'Article 4 Direction Area',
          council: currentArticle4.council || 'Unknown Council',
          reference: currentArticle4.reference || 'Current Article 4'
        });
      }
      
      return {
        inArticle4,
        status: currentArticle4 ? 'Active' : (upcomingArticle4 ? 'Upcoming' : 'Not in Article 4'),
        areas,
        confidence: 0.999,
        source: 'article4maps-api',
        postcode
      };
    }
    
    // Fallback for old format (single object response)
    const inArticle4 = data.article4_applies === true || 
                       data.in_article4 === true ||
                       (data.status && data.status.toLowerCase() === 'active');
    
    const areas: Array<{ name: string; council: string; reference: string }> = [];
    
    if (inArticle4) {
      areas.push({
        name: data.area_name || data.name || 'Article 4 Direction Area',
        council: data.council || data.local_authority || 'Unknown Council',
        reference: data.reference || data.direction_id || data.id || 'No Reference'
      });
    }

    return {
      inArticle4,
      status: data.status || (inArticle4 ? 'Active' : 'Not in Article 4'),
      areas,
      confidence: 0.999,
      source: 'article4maps-api',
      postcode
    };
  }

  /**
   * Get API usage stats (if available)
   */
  public async getUsageStats(): Promise<{
    calls_remaining: number;
    calls_used: number;
    reset_date: string;
  } | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      // Root endpoint returns quota info
      const response = await fetch(`${this.apiBaseUrl}/`, {
        method: 'GET',
        headers: {
          'Authorization': this.apiKey!,
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Transform response to match expected format
        if (Array.isArray(data) && data[0]) {
          const quota = data[0];
          return {
            calls_remaining: quota.quotamonth - quota.countmonth,
            calls_used: quota.countmonth,
            reset_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
          };
        }
        return null;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to get API usage stats:', error);
      return null;
    }
  }
}

export const article4MapsApiService = new Article4MapsApiService();
