const crypto = require("crypto");
const express = require("express");
const Payment = require("../models/Payment");

const router = express.Router();

const plans = {
  basic: { name: "Basic", amount: 799 },
  premium: { name: "Premium", amount: 1599 },
  elite: { name: "Elite", amount: 3199 }
};

function getPlan(planKey) {
  return plans[String(planKey || "").toLowerCase()] || null;
}

function hasRazorpayKeys() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function createDemoOrderId() {
  return `order_demo_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

async function createRazorpayOrder(plan) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: plan.amount * 100,
      currency: "INR",
      receipt: `smart_tracker_${Date.now()}`
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.description || "Unable to create Razorpay order");
  }

  return data;
}

router.get("/config", (req, res) => {
  res.json({
    keyId: process.env.RAZORPAY_KEY_ID || "",
    demoMode: !hasRazorpayKeys()
  });
});

router.post("/create-order", async (req, res) => {
  try {
    const { planKey, customerName, customerEmail } = req.body;
    const plan = getPlan(planKey);

    if (!plan) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    if (!hasRazorpayKeys()) {
      const orderId = createDemoOrderId();
      await Payment.create({
        plan: plan.name,
        amount: plan.amount,
        customerName: customerName || "Guest",
        customerEmail: customerEmail || "",
        orderId,
        mode: "demo",
        status: "created"
      });

      return res.json({
        demoMode: true,
        order: {
          id: orderId,
          amount: plan.amount * 100,
          currency: "INR"
        },
        plan
      });
    }

    const order = await createRazorpayOrder(plan);
    await Payment.create({
      plan: plan.name,
      amount: plan.amount,
      customerName: customerName || "Guest",
      customerEmail: customerEmail || "",
      orderId: order.id,
      mode: "razorpay",
      status: "created",
      rawResponse: order
    });

    res.json({
      demoMode: false,
      keyId: process.env.RAZORPAY_KEY_ID,
      order,
      plan
    });
  } catch (error) {
    res.status(500).json({ message: "Payment order failed", error: error.message });
  }
});

router.post("/demo-success", async (req, res) => {
  try {
    const { orderId } = req.body;

    const payment = await Payment.updateByOrderId(
      orderId,
      {
        status: "paid",
        paymentId: `pay_demo_${Date.now()}`,
        rawResponse: { demo: true, paidAt: new Date() }
      }
    );

    if (!payment) {
      return res.status(404).json({ message: "Payment order not found" });
    }

    res.json({ message: "Demo payment successful", payment });
  } catch (error) {
    res.status(500).json({ message: "Demo payment failed", error: error.message });
  }
});

router.post("/verify", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Payment verification details are required" });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      await Payment.updateByOrderId(razorpay_order_id, { status: "failed", rawResponse: req.body });
      return res.status(400).json({ message: "Payment verification failed" });
    }

    const payment = await Payment.updateByOrderId(
      razorpay_order_id,
      {
        status: "paid",
        paymentId: razorpay_payment_id,
        rawResponse: req.body
      }
    );

    res.json({ message: "Payment successful", payment });
  } catch (error) {
    res.status(500).json({ message: "Payment verification failed", error: error.message });
  }
});

module.exports = router;
