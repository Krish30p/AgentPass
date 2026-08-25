# AgentPass 🛡️💳
### Permission & Consent System for Autonomous AI Commerce

> **Razorpay AI Buildathon 2026** — Identity, Scoped Permission, and Revocable Consent Layer for AI Agents.

---

## 🌟 Overview

AgentPass issues AI agents a scoped **"passport"** (like an OAuth scope, but for money): a spend cap, allowed SKUs/categories, and a validity time window. Every purchase request from an agent is checked against its passport by a **Decision Engine**, which returns `Allow`, `Deny`, or `Needs-approval` with a plain-language reason. 

Every decision is logged in a real-time audit trail. Merchants can revoke or adjust passports live from the **Merchant Console**, with immediate effect on subsequent agent requests.

---

## 🏗️ Tech Stack

- **Backend:** Node.js + Express
- **Database:** MongoDB (Atlas / In-Memory fallback) via Mongoose
- **Payments:** Razorpay Node SDK (Test Mode)
- **Frontend:** React + Vite + Tailwind CSS
- **Real-time updates:** Polling (`setInterval` every 2.5s)
- **Agent Simulator:** `demo.js` (Node.js script using `axios`)

---

## 🔑 Environment Variables (`.env`)

Create a `.env` file in the root directory with the following variables:

```env
PORT=5001
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/agentpass
RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
RAZORPAY_KEY_SECRET=YourKeySecretHere
```

*Note: If `MONGODB_URI` or `RAZORPAY` keys are omitted, AgentPass automatically runs using an in-memory MongoDB server and realistic test-order generator, ensuring 100% offline reliability for local testing.*

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..
```

### 2. Start Backend Server
```bash
npm start
```
*Backend runs on `http://localhost:5001`*

### 3. Start Merchant Console (Frontend)
In a separate terminal:
```bash
cd client
npm run dev
```
*Console runs on `http://localhost:3000`*

### 4. Run the 5-Step Demo Script
In another terminal:
```bash
npm run demo
```

---

## 📊 Decision Engine Policy Rules

For each incoming `{ agentId, sku, amount, category }` request:
1. **Active Passport Check:** If no passport exists or status is `"revoked"` → `DENY`: *"No active passport for this agent."*
2. **Validity Window Check:** If current time is outside `validFrom` / `validUntil` → `DENY`: *"Passport is outside its valid time window."*
3. **SKU / Category Scope Check:** If SKU or Category is not explicitly allowed → `DENY`: *"SKU/category not permitted by this passport."*
4. **Cumulative Spend Cap Check:** If `spentSoFar + amount > spendCap` → `DENY`: *"Request would exceed remaining spend cap (₹X of ₹Y remaining)."* (Includes suggested alternative available amount).
5. **Allow & Execute:** If all checks pass → `ALLOW`: *"Within spend cap and permitted SKU list."*, creates a Razorpay test order, updates cumulative spend, and writes to audit log.

---

## 📜 Data Models

### `passports` Schema
```json
{
  "agentId": "agent-alpha",
  "merchantId": "merchant-main",
  "actingFor": "Corporate Procurements",
  "spendCap": 2000,
  "spentSoFar": 1200,
  "currency": "INR",
  "allowedCategories": ["gadgets", "electronics"],
  "allowedSkus": ["SKU-GADGET-1"],
  "validFrom": "2026-08-26T00:00:00.000Z",
  "validUntil": "2026-09-02T00:00:00.000Z",
  "singleUse": false,
  "status": "active"
}
```

### `decisionLogs` Schema
```json
{
  "agentId": "agent-alpha",
  "passportId": "658f1a2b3c4d5e6f7a8b9c0d",
  "request": { "sku": "SKU-GADGET-1", "amount": 1200, "category": "gadgets" },
  "decision": "allow",
  "reason": "Within spend cap and permitted SKU list.",
  "razorpayOrderId": "order_P1a2b3c4d5e6f",
  "timestamp": "2026-08-26T02:00:00.000Z"
}
```

---

## 🎥 Demo Narrative Flow (`demo.js`)

1. **Seed Passport:** Creates a passport for `agent-alpha` with ₹2000 spend cap.
2. **Request 1 (₹1200):** Valid request → Returns `ALLOW` + Razorpay Order ID.
3. **Request 2 (₹1500):** Overspend attempt → Returns `DENY` with exact remaining amount explanation (₹800 remaining).
4. **Merchant Intervention:** Merchant raises spend cap to ₹5000 via live Console/API.
5. **Request 3 (₹1500 Retry):** Retried request → Returns `ALLOW` + Razorpay Order ID.
6. **Audit Trail:** Prints full chronological decision log.
# AgentPass
