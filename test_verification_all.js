import axios from 'axios';
import { spawn } from 'child_process';

const BASE_URL = 'http://localhost:5001';

async function waitForServer() {
  for (let i = 0; i < 10; i++) {
    try {
      await axios.get(`${BASE_URL}/passports`);
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 400));
    }
  }
  return false;
}

async function runFullVerification() {
  console.log('--- STARTING BACKEND SERVER ---');
  const serverProc = spawn('node', ['server.js'], { stdio: 'inherit' });
  await waitForServer();

  try {
    console.log('\n--- 1. SEED DATABASE ---');
    await axios.post(`${BASE_URL}/api/seed`);

    console.log('\n--- 2. EXECUTE 3-STEP DEMO TRANSACTIONS ---');
    // Req 1: ₹1200 ALLOW
    const r1 = await axios.post(`${BASE_URL}/transaction-request`, {
      agentId: 'agent-alpha', sku: 'SKU-GADGET-1', amount: 1200, category: 'gadgets'
    });
    console.log('R1 Outcome:', r1.data.decision, '| Reason:', r1.data.reason);

    // Req 2: ₹1500 DENY (over spend cap)
    const r2 = await axios.post(`${BASE_URL}/transaction-request`, {
      agentId: 'agent-alpha', sku: 'SKU-GADGET-1', amount: 1500, category: 'gadgets'
    });
    console.log('R2 Outcome:', r2.data.decision, '| Reason:', r2.data.reason);

    // Patch Cap
    const passRes = await axios.get(`${BASE_URL}/passports`);
    const pId = passRes.data[0]._id;
    await axios.patch(`${BASE_URL}/passports/${pId}`, { spendCap: 5000 });

    // Req 3: Retry ₹1500 ALLOW
    const r3 = await axios.post(`${BASE_URL}/transaction-request`, {
      agentId: 'agent-alpha', sku: 'SKU-GADGET-1', amount: 1500, category: 'gadgets'
    });
    console.log('R3 Outcome:', r3.data.decision, '| Reason:', r3.data.reason);

    console.log('\n--- 3. TEST NEEDS-APPROVAL FLOW ---');
    // Req 4: Flagged request -> NEEDS-APPROVAL
    const r4 = await axios.post(`${BASE_URL}/transaction-request`, {
      agentId: 'agent-alpha', sku: 'SKU-HIGHVAL-1', amount: 1800, category: 'gadgets', flagNeedsApproval: true
    });
    console.log('R4 Outcome:', r4.data.decision, '| Log ID:', r4.data.logId);

    // Resolve R4 via PATCH /audit-log/:id/resolve
    console.log('Resolving R4 -> APPROVE...');
    const resolveRes = await axios.patch(`${BASE_URL}/audit-log/${r4.data.logId}/resolve`, { action: 'approve' });
    console.log('R4 Resolved Decision:', resolveRes.data.decision, '| Razorpay Order ID:', resolveRes.data.razorpayOrderId);

    console.log('\n--- 4. AUDIT LOG CONSISTENCY CHECK ---');
    const auditRes = await axios.get(`${BASE_URL}/audit-log?agentId=agent-alpha`);
    console.log(`Total Audit Log Entries Returned: ${auditRes.data.length}`);
    auditRes.data.forEach((log, i) => {
      console.log(`Log ${i + 1}: [${log.decision.toUpperCase()}] Amount: ₹${log.request.amount} | Reason: "${log.reason}"`);
    });

    if (auditRes.data.length === 4) {
      console.log('\n✓ VERIFICATION SUCCESS: All decisions (ALLOW, DENY, NEEDS-APPROVAL) logged and consistent!');
    } else {
      console.error('\n✕ VERIFICATION ERROR: Unexpected log count');
    }

  } catch (err) {
    console.error('Verification error:', err.response ? err.response.data : err.message);
  } finally {
    serverProc.kill();
    process.exit(0);
  }
}

runFullVerification();
