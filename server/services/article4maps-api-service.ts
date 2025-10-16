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
    this.apiBaseUrl = process.env.ARTICLE4MAPS_API_URL || 'https://api.article4map.com/v1';
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
      
      const response = await fetch(`${this.apiBaseUrl}/check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postcode: cleanPostcode,
          include_upcoming: true
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
      
      const response = await fetch(`${this.apiBaseUrl}/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
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
      const response = await fetch(`${this.apiBaseUrl}/usage`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        }
      });

      if (response.ok) {
        return await response.json();
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to get API usage stats:', error);
      return null;
    }
  }
}

export const article4MapsApiService = new Article4MapsApiService();
