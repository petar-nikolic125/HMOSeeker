async function testBulkLondon() {
  const apiKey = process.env.ARTICLE4MAPS_API_KEY;
  
  if (!apiKey) {
    console.error('❌ API ključ nije postavljen!');
    process.exit(1);
  }
  
  console.log('🧪 Testiram da li "London" vraća sve Article 4 oblasti odjednom...\n');
  
  try {
    const response = await fetch('https://api.article4map.com/text', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-type': 'application/json'
      },
      body: JSON.stringify({
        search: 'London',
        type: 'current'
      })
    });

    if (!response.ok) {
      console.error(`❌ API greška: ${response.status} ${response.statusText}`);
      process.exit(1);
    }

    const data = await response.json();
    
    console.log('📊 Rezultat:\n');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n');
    
    if (Array.isArray(data) && data.length > 0) {
      console.log(`✅ Vraćeno ${data.length} rezultata`);
      console.log('📋 Resolved addresses:');
      data.forEach((r: any) => {
        console.log(`   - ${r.resolvedaddress || 'N/A'}`);
      });
    } else {
      console.log('⚠️ Nema bulk rezultata - moraćemo da proveravamo pojedinačno');
    }
    
  } catch (error: any) {
    console.error('❌ Greška:', error.message);
  }
}

testBulkLondon();
