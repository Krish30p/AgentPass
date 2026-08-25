import mongoose from 'mongoose';

const passportSchema = new mongoose.Schema({
  agentId: { type: String, required: true, index: true },
  merchantId: { type: String, required: true, default: 'merchant-m1' },
  actingFor: { type: String, required: true, default: 'User' },
  spendCap: { type: Number, required: true, default: 0 },
  spentSoFar: { type: Number, required: true, default: 0 },
  currency: { type: String, default: 'INR' },
  allowedCategories: [{ type: String }],
  allowedSkus: [{ type: String }],
  validFrom: { type: Date, default: Date.now },
  validUntil: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  singleUse: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'revoked'], default: 'active' }
}, { timestamps: true });

export default mongoose.model('Passport', passportSchema);
