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

async function testPersistence() {
  console.log('--- TEST 1: Start Server Instance 1 ---');
  let serverProc = spawn('node', ['server.js'], { stdio: 'inherit' });
  await waitForServer();

  console.log('\n--- TEST 2: Seed Data ---');
  const seedRes = await axios.post(`${BASE_URL}/api/seed`);
  console.log('Seed response:', seedRes.data.message);

  const initialPassports = await axios.get(`${BASE_URL}/passports`);
  console.log(`Initial Passports Count: ${initialPassports.data.length}`);
  const passportAgentId = initialPassports.data[0].agentId;

  console.log('\n--- TEST 3: Kill Server Instance 1 ---');
  serverProc.kill();
  await new Promise(r => setTimeout(r, 1000));

  console.log('\n--- TEST 4: Restart Server Instance 2 ---');
  serverProc = spawn('node', ['server.js'], { stdio: 'inherit' });
  await waitForServer();

  console.log('\n--- TEST 5: Verify Data Persistence after Restart ---');
  const restartedPassports = await axios.get(`${BASE_URL}/passports`);
  console.log(`Passports Count after Restart: ${restartedPassports.data.length}`);
  console.log(`Retrieved Passport AgentId: ${restartedPassports.data[0]?.agentId}`);

  if (restartedPassports.data.length > 0 && restartedPassports.data[0]?.agentId === passportAgentId) {
    console.log('\n✓ PERSISTENCE TEST SUCCESS: MongoDB data survived server restart!');
  } else {
    console.error('\n✕ PERSISTENCE TEST FAILED: Data was lost after server restart!');
  }

  serverProc.kill();
  process.exit(0);
}

testPersistence();
