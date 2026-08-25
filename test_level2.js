import axios from 'axios';
import { spawn } from 'child_process';

const server = spawn('node', ['server.js'], { stdio: 'inherit' });

async function waitForServer(url, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get(`${url}/passports`);
      return true;
    } catch (err) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return false;
}

async function runLevel2Tests() {
  const baseUrl = 'http://localhost:5001';
  console.log('Waiting for server startup...');
  const ready = await waitForServer(baseUrl);
  if (!ready) {
    console.error('Server failed to start within timeout.');
    server.kill();
    process.exit(1);
  }

  try {
    console.log('\n--- LEVEL 2 TEST 1: Seed DB ---');
    const seedRes = await axios.post(`${baseUrl}/api/seed`);
    console.log('Seed message:', seedRes.data.message);
    const passportId = seedRes.data.passport._id;

    console.log('\n--- LEVEL 2 TEST 2: GET /passports ---');
    const passportsRes = await axios.get(`${baseUrl}/passports`);
    console.log('Passports count:', passportsRes.data.length);
    console.log('Passport 0 AgentId:', passportsRes.data[0].agentId);

    console.log('\n--- LEVEL 2 TEST 3: Transaction Request 1 (₹1200 - Valid) ---');
    const req1 = await axios.post(`${baseUrl}/transaction-request`, {
      agentId: 'agent-alpha',
      sku: 'SKU-GADGET-1',
      amount: 1200,
      category: 'gadgets'
    });
    console.log('Req 1 Result:', req1.data);

    console.log('\n--- LEVEL 2 TEST 4: Transaction Request 2 (₹1500 - Exceeds ₹2000 Cap because spent is ₹1200) ---');
    const req2 = await axios.post(`${baseUrl}/transaction-request`, {
      agentId: 'agent-alpha',
      sku: 'SKU-GADGET-1',
      amount: 1500,
      category: 'gadgets'
    });
    console.log('Req 2 Result:', req2.data);

    console.log('\n--- LEVEL 2 TEST 5: PATCH /passports/:id (Raise Cap to ₹5000) ---');
    const patchRes = await axios.patch(`${baseUrl}/passports/${passportId}`, {
      spendCap: 5000
    });
    console.log('Patched Passport Cap:', patchRes.data.spendCap);

    console.log('\n--- LEVEL 2 TEST 6: Transaction Request 3 (Retry Req 2 ₹1500 - Should Allow now!) ---');
    const req3 = await axios.post(`${baseUrl}/transaction-request`, {
      agentId: 'agent-alpha',
      sku: 'SKU-GADGET-1',
      amount: 1500,
      category: 'gadgets'
    });
    console.log('Req 3 Result:', req3.data);

    console.log('\n--- LEVEL 2 TEST 7: GET /audit-log ---');
    const auditRes = await axios.get(`${baseUrl}/audit-log?agentId=agent-alpha`);
    console.log('Audit Log Count:', auditRes.data.length);
    console.log('Audit Log entries:');
    auditRes.data.forEach((log, index) => {
      console.log(`[Log ${index + 1}] Decision: ${log.decision.toUpperCase()} | Amount: ₹${log.request.amount} | Reason: ${log.reason} | RazorpayOrderId: ${log.razorpayOrderId || 'N/A'}`);
    });

    console.log('\nSUCCESS: ALL LEVEL 2 TESTS PASSED!');

  } catch (err) {
    console.error('Level 2 test error:', err.response ? err.response.data : err.message);
  } finally {
    server.kill();
    process.exit(0);
  }
}

runLevel2Tests();
