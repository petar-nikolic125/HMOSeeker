import * as fs from 'fs';
import * as path from 'path';

const LONDON_POSTCODES = {
  E: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E20', 'E1W'],
  EC: ['EC1A', 'EC1M', 'EC1N', 'EC1P', 'EC1R', 'EC1V', 'EC1Y', 'EC2A', 'EC2M', 'EC2N', 'EC2P', 'EC2R', 'EC2V', 'EC2Y', 'EC3A', 'EC3M', 'EC3N', 'EC3P', 'EC3R', 'EC3V', 'EC4A', 'EC4M', 'EC4N', 'EC4P', 'EC4R', 'EC4V', 'EC4Y'],
  N: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10', 'N11', 'N12', 'N13', 'N14', 'N15', 'N16', 'N17', 'N18', 'N19', 'N20', 'N21', 'N22', 'N1C', 'N1P'],
  NW: ['NW1', 'NW2', 'NW3', 'NW4', 'NW5', 'NW6', 'NW7', 'NW8', 'NW9', 'NW10', 'NW11', 'NW1W'],
  SE: ['SE1', 'SE2', 'SE3', 'SE4', 'SE5', 'SE6', 'SE7', 'SE8', 'SE9', 'SE10', 'SE11', 'SE12', 'SE13', 'SE14', 'SE15', 'SE16', 'SE17', 'SE18', 'SE19', 'SE20', 'SE21', 'SE22', 'SE23', 'SE24', 'SE25', 'SE26', 'SE27', 'SE28', 'SE1P'],
  SW: ['SW1A', 'SW1E', 'SW1H', 'SW1P', 'SW1V', 'SW1W', 'SW1X', 'SW1Y', 'SW2', 'SW3', 'SW4', 'SW5', 'SW6', 'SW7', 'SW8', 'SW9', 'SW10', 'SW11', 'SW12', 'SW13', 'SW14', 'SW15', 'SW16', 'SW17', 'SW18', 'SW19', 'SW20'],
  W: ['W1A', 'W1B', 'W1C', 'W1D', 'W1F', 'W1G', 'W1H', 'W1J', 'W1K', 'W1S', 'W1T', 'W1U', 'W1W', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13', 'W14'],
  WC: ['WC1A', 'WC1B', 'WC1E', 'WC1H', 'WC1N', 'WC1R', 'WC1V', 'WC1X', 'WC2A', 'WC2B', 'WC2E', 'WC2H', 'WC2N', 'WC2R']
};

interface Article4ApiResult {
  status: string;
  type: 'current' | 'upcoming';
  resolvedaddress: string;
}

interface Article4Result {
  postcode: string;
  area: string;
  hasArticle4Current: boolean;
  hasArticle4Upcoming: boolean;
  currentStatus?: string;
  upcomingStatus?: string;
  resolvedAddress?: string;
  error?: string;
}

async function checkPostcode(postcode: string, apiKey: string): Promise<Article4ApiResult[] | null> {
  try {
    const response = await fetch('https://api.article4map.com/text', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-type': 'application/json'
      },
      body: JSON.stringify({
        search: postcode,
        type: 'all'
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : null;
  } catch (error: any) {
    throw error;
  }
}

async function checkAllPostcodes() {
  console.log('🚀 Pokrećem proveru svih London postkodova...\n');
  
  const apiKey = process.env.ARTICLE4MAPS_API_KEY;
  
  if (!apiKey) {
    console.error('❌ ARTICLE4MAPS_API_KEY nije postavljen!');
    console.error('Postavi ključ u Replit Secrets ili environment variables.');
    process.exit(1);
  }
  
  const allPostcodes: string[] = [];
  Object.entries(LONDON_POSTCODES).forEach(([area, codes]) => {
    allPostcodes.push(...codes);
  });
  
  console.log(`📊 Ukupno postkodova za proveru: ${allPostcodes.length}\n`);
  
  const results: Article4Result[] = [];
  const delayBetweenCalls = 3000;
  
  for (let i = 0; i < allPostcodes.length; i++) {
    const postcode = allPostcodes[i];
    const progress = Math.round((i / allPostcodes.length) * 100);
    
    console.log(`[${i + 1}/${allPostcodes.length}] (${progress}%) Proveravam ${postcode}...`);
    
    let retries = 0;
    let success = false;
    
    while (!success && retries < 3) {
      try {
        const apiResults = await checkPostcode(postcode, apiKey);
        
        if (!apiResults || apiResults.length === 0) {
          results.push({
            postcode,
            area: getArea(postcode),
            hasArticle4Current: false,
            hasArticle4Upcoming: false
          });
          success = true;
          continue;
        }
        
        const current = apiResults.find(r => r.type === 'current');
        const upcoming = apiResults.find(r => r.type === 'upcoming');
        
        const result: Article4Result = {
          postcode,
          area: getArea(postcode),
          hasArticle4Current: !!current,
          hasArticle4Upcoming: !!upcoming,
          currentStatus: current?.status,
          upcomingStatus: upcoming?.status,
          resolvedAddress: apiResults[0]?.resolvedaddress
        };
        
        if (result.hasArticle4Current || result.hasArticle4Upcoming) {
          console.log(`   🔴 Article 4 detektovan! Current: ${result.hasArticle4Current}, Upcoming: ${result.hasArticle4Upcoming}`);
        }
        
        results.push(result);
        success = true;
        
      } catch (error: any) {
        if (error.message.includes('Rate limit')) {
          retries++;
          console.log(`   ⏸️ Rate limit - čekam 5 sekundi i pokušavam ponovo (pokušaj ${retries}/3)...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          console.error(`   ❌ Greška: ${error.message}`);
          results.push({
            postcode,
            area: getArea(postcode),
            hasArticle4Current: false,
            hasArticle4Upcoming: false,
            error: error.message
          });
          success = true;
        }
      }
    }
    
    if (!success) {
      console.error(`   ❌ Prekoračen broj pokušaja za ${postcode}`);
      results.push({
        postcode,
        area: getArea(postcode),
        hasArticle4Current: false,
        hasArticle4Upcoming: false,
        error: 'Max retries exceeded'
      });
    }
    
    if (i < allPostcodes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenCalls));
    }
  }
  
  const outputPath = path.join(process.cwd(), 'cache', 'article4-london-postcodes.json');
  const cacheDir = path.dirname(outputPath);
  
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  
  console.log('\n✅ Provera završena!');
  console.log(`📁 Rezultati sačuvani u: ${outputPath}\n`);
  
  printSummary(results);
  
  return results;
}

function getArea(postcode: string): string {
  for (const [area, codes] of Object.entries(LONDON_POSTCODES)) {
    if (codes.includes(postcode)) {
      return area;
    }
  }
  return 'Unknown';
}

function printSummary(results: Article4Result[]) {
  const withCurrentArticle4 = results.filter(r => r.hasArticle4Current);
  const withUpcomingArticle4 = results.filter(r => r.hasArticle4Upcoming);
  const withErrors = results.filter(r => r.error);
  
  console.log('📊 STATISTIKA:');
  console.log(`   Ukupno postkodova: ${results.length}`);
  console.log(`   🔴 Sa TRENUTNIM Article 4: ${withCurrentArticle4.length}`);
  console.log(`   ⏰ Sa nadolazećim Article 4: ${withUpcomingArticle4.length}`);
  console.log(`   ❌ Greške: ${withErrors.length}\n`);
  
  if (withCurrentArticle4.length > 0) {
    console.log('🔴 TRENUTNE ARTICLE 4 OBLASTI (VAŽNO!):');
    withCurrentArticle4.forEach(r => {
      console.log(`   ${r.postcode} (${r.area}): ${r.currentStatus}`);
    });
    console.log('');
    
    console.log('📋 KOMPAKTNA LISTA TRENUTNIH ARTICLE 4:');
    const currentList = withCurrentArticle4.map(r => r.postcode).join(', ');
    console.log(`   ${currentList}\n`);
  }
  
  if (withUpcomingArticle4.length > 0) {
    console.log('🟡 NADOLAZEĆE ARTICLE 4 OBLASTI:');
    withUpcomingArticle4.forEach(r => {
      console.log(`   ${r.postcode} (${r.area}): ${r.upcomingStatus}`);
    });
    console.log('');
  }
  
  const byArea = results.reduce((acc, r) => {
    if (!acc[r.area]) {
      acc[r.area] = { total: 0, current: 0, upcoming: 0 };
    }
    acc[r.area].total++;
    if (r.hasArticle4Current) acc[r.area].current++;
    if (r.hasArticle4Upcoming) acc[r.area].upcoming++;
    return acc;
  }, {} as Record<string, { total: number, current: number, upcoming: number }>);
  
  console.log('📍 PO OBLASTIMA:');
  Object.entries(byArea)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([area, stats]) => {
      const article4Info = stats.current > 0 || stats.upcoming > 0 
        ? ` | 🔴 ${stats.current} trenutni, 🟡 ${stats.upcoming} nadolazeći`
        : '';
      console.log(`   ${area.padEnd(4)}: ${stats.total} postkodova${article4Info}`);
    });
}

checkAllPostcodes().catch(console.error);
