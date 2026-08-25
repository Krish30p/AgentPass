import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Passport from './models/Passport.js';
import DecisionLog from './models/DecisionLog.js';
import { processTransactionRequest, resolvePendingDecision } from './services/decisionEngine.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. DATABASE CONNECTION CHECK: Connect strictly to real MongoDB
async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agentpass';
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    const maskedUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    console.log(`[AgentPass DB] Successfully connected to persistent MongoDB at ${maskedUri}`);
  } catch (err) {
    console.error(`[AgentPass DB CRITICAL ERROR] Failed to connect to MongoDB at ${mongoUri}:`, err.message);
    console.error('Please ensure MongoDB service is running or MONGODB_URI is set correctly in .env.');
    process.exit(1); // Fail loudly as required
  }
}

// Passports CRUD Endpoints
const createPassportHandler = async (req, res) => {
  try {
    const passportData = req.body;
    if (passportData.agentId) {
      const existing = await Passport.findOne({ agentId: passportData.agentId });
      if (existing) {
        Object.assign(existing, passportData);
        if (passportData.spendCap !== undefined) existing.spendCap = Number(passportData.spendCap);
        if (passportData.status !== undefined) existing.status = passportData.status;
        await existing.save();
        return res.json(existing);
      }
    }
    const passport = await Passport.create(passportData);
    return res.status(201).json(passport);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const getPassportsHandler = async (req, res) => {
  try {
    const passports = await Passport.find().sort({ createdAt: -1 });
    return res.json(passports);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getPassportByIdHandler = async (req, res) => {
  try {
    const passport = await Passport.findById(req.params.id);
    if (!passport) return res.status(404).json({ error: 'Passport not found' });
    return res.json(passport);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updatePassportHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const passport = await Passport.findById(id);
    if (!passport) return res.status(404).json({ error: 'Passport not found' });

    if (req.body.spendCap !== undefined) passport.spendCap = Number(req.body.spendCap);
    if (req.body.status !== undefined) passport.status = req.body.status;
    if (req.body.allowedCategories !== undefined) passport.allowedCategories = req.body.allowedCategories;
    if (req.body.allowedSkus !== undefined) passport.allowedSkus = req.body.allowedSkus;
    if (req.body.validUntil !== undefined) passport.validUntil = req.body.validUntil;
    if (req.body.requireApprovalAbove !== undefined) passport.requireApprovalAbove = Number(req.body.requireApprovalAbove);

    await passport.save();
    return res.json(passport);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

app.post('/passports', createPassportHandler);
app.post('/api/passports', createPassportHandler);
app.get('/passports', getPassportsHandler);
app.get('/api/passports', getPassportsHandler);
app.get('/passports/:id', getPassportByIdHandler);
app.get('/api/passports/:id', getPassportByIdHandler);
app.patch('/passports/:id', updatePassportHandler);
app.patch('/api/passports/:id', updatePassportHandler);

// Transaction Request Endpoint
const transactionRequestHandler = async (req, res) => {
  try {
    const { agentId, sku, amount, category, flagNeedsApproval } = req.body;
    if (!agentId || amount == null) {
      return res.status(400).json({ error: 'Missing required fields: agentId, amount' });
    }

    const result = await processTransactionRequest({ agentId, sku, amount, category, flagNeedsApproval });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

app.post('/transaction-request', transactionRequestHandler);
app.post('/api/transaction-request', transactionRequestHandler);

// Resolution endpoint for Needs-Approval decision logs
const resolveDecisionHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // "approve" | "deny"
    if (!['approve', 'deny'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "approve" or "deny"' });
    }

    const updatedLog = await resolvePendingDecision(id, action);
    return res.json(updatedLog);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

app.patch('/audit-log/:id/resolve', resolveDecisionHandler);
app.patch('/api/audit-log/:id/resolve', resolveDecisionHandler);

// Audit Trail Endpoint
const auditLogHandler = async (req, res) => {
  try {
    const { agentId, passportId } = req.query;
    const filter = {};
    if (agentId) filter.agentId = agentId;
    if (passportId) filter.passportId = passportId;

    const logs = await DecisionLog.find(filter).sort({ timestamp: -1 }).limit(100);
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

app.get('/audit-log', auditLogHandler);
app.get('/api/audit-log', auditLogHandler);

// Seed endpoint for quick demo setup
app.post('/api/seed', async (req, res) => {
  try {
    await Passport.deleteMany({});
    await DecisionLog.deleteMany({});

    const p1 = await Passport.create({
      agentId: 'agent-alpha',
      merchantId: 'merchant-main',
      actingFor: 'Corporate Procurements',
      spendCap: 2000,
      spentSoFar: 0,
      currency: 'INR',
      allowedCategories: ['gadgets', 'electronics'],
      allowedSkus: ['SKU-GADGET-1', 'SKU-GADGET-2'],
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      singleUse: false,
      status: 'active'
    });

    return res.json({ message: 'Database seeded successfully', passport: p1 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5001;

async function startServer() {
  await connectDB();
  if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
      console.log(`[AgentPass Backend Server] Running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
