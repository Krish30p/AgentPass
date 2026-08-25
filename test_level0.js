import axios from 'axios';
import { spawn } from 'child_process';

const server = spawn('node', ['server.js'], { stdio: 'inherit' });

async function runTests() {
  // Wait for server start
  await new Promise(r => setTimeout(r, 1000));
  const baseUrl = 'http://localhost:5001';

  try {
    console.log('--- TEST 1: Valid Purchase within Cap (₹1200) ---');
    const res1 = await axios.post(`${baseUrl}/transaction-request`, {
      agentId: 'agent-007',
      sku: 'SKU-001',
      amount: 1200
    });
    console.log('Response 1:', res1.data);

    console.log('\n--- TEST 2: Overspend Purchase (₹1000, remaining is ₹800) ---');
    const res2 = await axios.post(`${baseUrl}/transaction-request`, {
      agentId: 'agent-007',
      sku: 'SKU-001',
      amount: 1000
    });
    console.log('Response 2:', res2.data);

    console.log('\n--- TEST 3: Disallowed SKU ---');
    const res3 = await axios.post(`${baseUrl}/transaction-request`, {
      agentId: 'agent-007',
      sku: 'SKU-999',
      amount: 100
    });
    console.log('Response 3:', res3.data);

    console.log('\n--- TEST 4: Unknown Agent ---');
    const res4 = await axios.post(`${baseUrl}/transaction-request`, {
      agentId: 'unknown-agent',
      sku: 'SKU-001',
      amount: 100
    });
    console.log('Response 4:', res4.data);

  } catch (err) {
    console.error('Test error:', err.response ? err.response.data : err.message);
  } finally {
    server.kill();
    process.exit(0);
  }
}

runTests();
