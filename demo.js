import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log('====================================================');
  console.log('       AgentPass — AI Agent Permission & Consent    ');
  console.log('               Live Demonstration Script            ');
  console.log('====================================================\n');

  try {
    // Step 1: Seed merchant + passport
    console.log('[STEP 1] Seeding Passport: ₹2000 Spend Cap, Category: "gadgets"');
    const seedRes = await axios.post(`${BASE_URL}/api/seed`);
    const passport = seedRes.data.passport;
    console.log(`✓ Created Passport for Agent: "${passport.agentId}" (ID: ${passport._id})`);
    console.log(`  Spend Cap: ₹${passport.spendCap} | Status: ${passport.status} | Category: ${passport.allowedCategories.join(', ')}\n`);

    await sleep(1500);

    // Step 2: Agent Request 1 (Valid purchase within cap: ₹1200)
    console.log('[STEP 2] Agent Request 1: Valid purchase for ₹1200 (SKU: "SKU-GADGET-1")');
    const req1 = await axios.post(`${BASE_URL}/transaction-request`, {
      agentId: passport.agentId,
      sku: 'SKU-GADGET-1',
      amount: 1200,
      category: 'gadgets'
    });
    console.log(`✓ Decision: [${req1.data.decision.toUpperCase()}]`);
    console.log(`  Reason: "${req1.data.reason}"`);
    console.log(`  Razorpay Order ID: ${req1.data.razorpayOrderId}\n`);

    await sleep(2000);

    // Step 3: Agent Request 2 (Purchase exceeding spend cap: ₹1500; spent: ₹1200 + ₹1500 = ₹2700 > ₹2000)
    console.log('[STEP 3] Agent Request 2: Purchase for ₹1500 (Exceeds ₹2000 Cap)');
    const req2 = await axios.post(`${BASE_URL}/transaction-request`, {
      agentId: passport.agentId,
      sku: 'SKU-GADGET-1',
      amount: 1500,
      category: 'gadgets'
    });
    console.log(`✕ Decision: [${req2.data.decision.toUpperCase()}]`);
    console.log(`  Reason: "${req2.data.reason}"`);
    if (req2.data.suggestedAlternative) {
      console.log(`  Suggested Alternative: ₹${req2.data.suggestedAlternative}`);
    }
    console.log();

    await sleep(2500);

    // Step 4: Merchant raises the cap live via API / Console (Patch to ₹5000)
    console.log('[STEP 4] Merchant Action: Raising Spend Cap live to ₹5000 from Console...');
    const patchRes = await axios.patch(`${BASE_URL}/passports/${passport._id}`, {
      spendCap: 5000
    });
    console.log(`✓ Passport Updated: New Spend Cap is ₹${patchRes.data.spendCap}\n`);

    await sleep(1500);

    // Step 5: Agent Request 3 (Retrying Request 2 after merchant raised cap)
    console.log('[STEP 5] Agent Request 3: Retrying purchase for ₹1500 after Cap raise');
    const req3 = await axios.post(`${BASE_URL}/transaction-request`, {
      agentId: passport.agentId,
      sku: 'SKU-GADGET-1',
      amount: 1500,
      category: 'gadgets'
    });
    console.log(`✓ Decision: [${req3.data.decision.toUpperCase()}]`);
    console.log(`  Reason: "${req3.data.reason}"`);
    console.log(`  Razorpay Order ID: ${req3.data.razorpayOrderId}\n`);

    await sleep(1500);

    // Step 6: Print Full Audit Trail
    console.log('[STEP 6] Fetching Full Merchant Audit Trail Timeline:');
    console.log('----------------------------------------------------');
    const auditRes = await axios.get(`${BASE_URL}/audit-log?agentId=${passport.agentId}`);
    
    auditRes.data.forEach((log, idx) => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      const statusSymbol = log.decision === 'allow' ? '✓ ALLOW' : '✕ DENY';
      console.log(`[${time}] ${statusSymbol} | Amount: ₹${log.request.amount} | SKU: ${log.request.sku}`);
      console.log(`         Reason: "${log.reason}"`);
      if (log.razorpayOrderId) console.log(`         Razorpay Order ID: ${log.razorpayOrderId}`);
      console.log('----------------------------------------------------');
    });

    console.log('\n====================================================');
    console.log('          DEMO FLOW COMPLETED SUCCESSFULLY          ');
    console.log('====================================================');

  } catch (err) {
    console.error('Demo Script Error:', err.response ? err.response.data : err.message);
  }
}

runDemo();
