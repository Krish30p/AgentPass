import mongoose from 'mongoose';

const decisionLogSchema = new mongoose.Schema({
  agentId: { type: String, required: true, index: true },
  passportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Passport', index: true },
  request: {
    sku: { type: String },
    amount: { type: Number, required: true },
    category: { type: String }
  },
  decision: { type: String, enum: ['allow', 'deny', 'needs-approval'], required: true },
  reason: { type: String, required: true },
  razorpayOrderId: { type: String, default: null },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('DecisionLog', decisionLogSchema);
