import * as fs from 'fs';
import * as path from 'path';

const MANCHESTER_POSTCODES = [
  'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9',
  'M11', 'M12', 'M13', 'M14', 'M15', 'M16', 'M17', 'M18', 'M19',
  'M20', 'M21', 'M22', 'M23', 'M24', 'M25', 'M26', 'M27', 'M28', 'M29',
  'M30', 'M31', 'M32', 'M34', 'M35', 'M38',
  'M40', 'M41', 'M43', 'M44', 'M45', 'M46', 'M50'
];

interface Article4ApiResult {
  status: string;
  type: 'current' | 'upcoming';
  resolvedaddress: string;
}

interface Article4Result {
  postcode: string;
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

async function checkAllManchesterPostcodes() {
  console.log('🚀 Pokrećem proveru svih Manchester postkodova...\n');
  
  const apiKey = process.env.ARTICLE4MAPS_API_KEY;
  
  if (!apiKey) {
    console.error('❌ ARTICLE4MAPS_API_KEY nije postavljen!');
    console.error('Postavi ključ u Replit Secrets ili environment variables.');
    process.exit(1);
  }
  
  console.log(`📊 Ukupno postkodova za proveru: ${MANCHESTER_POSTCODES.length}\n`);
  
  const results: Article4Result[] = [];
  const delayBetweenCalls = 3000;
  
  for (let i = 0; i < MANCHESTER_POSTCODES.length; i++) {
    const postcode = MANCHESTER_POSTCODES[i];
    const progress = Math.round((i / MANCHESTER_POSTCODES.length) * 100);
    
    console.log(`[${i + 1}/${MANCHESTER_POSTCODES.length}] (${progress}%) Proveravam ${postcode}...`);
    
    let retries = 0;
    let success = false;
    
    while (!success && retries < 3) {
      try {
        const apiResults = await checkPostcode(postcode, apiKey);
        
        if (!apiResults || apiResults.length === 0) {
          results.push({
            postcode,
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
        hasArticle4Current: false,
        hasArticle4Upcoming: false,
        error: 'Max retries exceeded'
      });
    }
    
    if (i < MANCHESTER_POSTCODES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenCalls));
    }
  }
  
  const outputPath = path.join(process.cwd(), 'cache', 'article4-manchester-postcodes.json');
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
      console.log(`   ${r.postcode}: ${r.currentStatus}`);
    });
    console.log('');
    
    console.log('📋 KOMPAKTNA LISTA TRENUTNIH ARTICLE 4:');
    const currentList = withCurrentArticle4.map(r => r.postcode).join(', ');
    console.log(`   ${currentList}\n`);
  } else {
    console.log('✅ MANCHESTER NEMA TRENUTNIH ARTICLE 4 OBLASTI!\n');
  }
  
  if (withUpcomingArticle4.length > 0) {
    console.log('🟡 NADOLAZEĆE ARTICLE 4 OBLASTI:');
    withUpcomingArticle4.forEach(r => {
      console.log(`   ${r.postcode}: ${r.upcomingStatus}`);
    });
    console.log('');
  }
}

checkAllManchesterPostcodes().catch(console.error);
