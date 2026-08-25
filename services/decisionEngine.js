import Passport from '../models/Passport.js';
import DecisionLog from '../models/DecisionLog.js';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummyKeyId',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummyKeySecret'
});

async function createRazorpayOrder(amount, currency = 'INR', receipt = '') {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (keyId && keySecret && !keyId.includes('dummy')) {
    try {
      const order = await razorpay.orders.create({
        amount: Math.round(amount * 100),
        currency: currency || 'INR',
        receipt: receipt || `rec_${Date.now()}`,
        notes: { system: 'AgentPass' }
      });
      return order.id;
    } catch (err) {
      console.warn('[Razorpay API Warning]:', err.message, '-> using simulated test order ID');
    }
  }

  return `order_${Math.random().toString(36).substring(2, 12)}`;
}

export async function processTransactionRequest({ agentId, sku, amount, category, flagNeedsApproval }) {
  // 1. Find passport for agentId
  const passport = await Passport.findOne({ agentId });

  if (!passport || passport.status === 'revoked') {
    const log = await DecisionLog.create({
      agentId,
      passportId: passport ? passport._id : null,
      request: { sku, amount, category },
      decision: 'deny',
      reason: 'No active passport for this agent.'
    });

    return {
      decision: 'deny',
      reason: 'No active passport for this agent.',
      logId: log._id
    };
  }

  // 2. Time window check
  const now = new Date();
  if (now < new Date(passport.validFrom) || now > new Date(passport.validUntil)) {
    const log = await DecisionLog.create({
      agentId,
      passportId: passport._id,
      request: { sku, amount, category },
      decision: 'deny',
      reason: 'Passport is outside its valid time window.'
    });

    return {
      decision: 'deny',
      reason: 'Passport is outside its valid time window.',
      passportId: passport._id,
      logId: log._id
    };
  }

  // 3. SKU / Category check
  const isSkuAllowed = passport.allowedSkus && passport.allowedSkus.includes(sku);
  const isCategoryAllowed = category && passport.allowedCategories && passport.allowedCategories.includes(category);
  if (!isSkuAllowed && !isCategoryAllowed) {
    const log = await DecisionLog.create({
      agentId,
      passportId: passport._id,
      request: { sku, amount, category },
      decision: 'deny',
      reason: 'SKU/category not permitted by this passport.'
    });

    return {
      decision: 'deny',
      reason: 'SKU/category not permitted by this passport.',
      passportId: passport._id,
      logId: log._id
    };
  }

  // 4. Spend cap check
  const remaining = passport.spendCap - passport.spentSoFar;
  if (passport.spentSoFar + amount > passport.spendCap) {
    const altText = remaining > 0 ? ` Suggested alternative amount: ₹${remaining}.` : '';
    const reasonMsg = `Request would exceed remaining spend cap (₹${remaining} of ₹${passport.spendCap} remaining).${altText}`;

    const log = await DecisionLog.create({
      agentId,
      passportId: passport._id,
      request: { sku, amount, category },
      decision: 'deny',
      reason: reasonMsg
    });

    return {
      decision: 'deny',
      reason: reasonMsg,
      passportId: passport._id,
      logId: log._id,
      suggestedAlternative: remaining > 0 ? remaining : null
    };
  }

  // 5. Needs-Approval Check (Flagged or exceeds soft cap threshold if set)
  const isNeedsApproval = flagNeedsApproval || (passport.requireApprovalAbove && amount >= passport.requireApprovalAbove);
  if (isNeedsApproval) {
    const log = await DecisionLog.create({
      agentId,
      passportId: passport._id,
      request: { sku, amount, category },
      decision: 'needs-approval',
      reason: 'Flagged transaction requires human merchant approval.'
    });

    return {
      decision: 'needs-approval',
      reason: 'Flagged transaction requires human merchant approval.',
      passportId: passport._id,
      logId: log._id
    };
  }

  // 6. Allow -> Create Razorpay Order & update cumulative spentSoFar
  const razorpayOrderId = await createRazorpayOrder(amount, passport.currency, `receipt_${agentId}`);
  
  passport.spentSoFar += amount;
  if (passport.singleUse) {
    passport.status = 'revoked';
  }
  await passport.save();

  const log = await DecisionLog.create({
    agentId,
    passportId: passport._id,
    request: { sku, amount, category },
    decision: 'allow',
    reason: 'Within spend cap and permitted SKU list.',
    razorpayOrderId
  });

  return {
    decision: 'allow',
    reason: 'Within spend cap and permitted SKU list.',
    razorpayOrderId,
    passportId: passport._id,
    logId: log._id
  };
}

export async function resolvePendingDecision(logId, action) {
  const log = await DecisionLog.findById(logId);
  if (!log) throw new Error('Decision log entry not found');
  if (log.decision !== 'needs-approval') {
    throw new Error(`Decision log is not in 'needs-approval' state (current: ${log.decision})`);
  }

  const passport = await Passport.findById(log.passportId);

  if (action === 'approve') {
    if (passport) {
      if (passport.spentSoFar + log.request.amount > passport.spendCap) {
        throw new Error('Approval denied: Passport spend cap would be exceeded.');
      }
      passport.spentSoFar += log.request.amount;
      await passport.save();
    }

    const razorpayOrderId = await createRazorpayOrder(log.request.amount, passport ? passport.currency : 'INR', `receipt_approved_${log.agentId}`);
    log.decision = 'allow';
    log.reason = 'Approved by merchant from console.';
    log.razorpayOrderId = razorpayOrderId;
    await log.save();
    return log;
  } else if (action === 'deny') {
    log.decision = 'deny';
    log.reason = 'Denied by merchant from console.';
    await log.save();
    return log;
  }
}
