const crypto = require("crypto");
const { query } = require("../db/pool");

function mapPayment(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    plan: row.plan,
    amount: Number(row.amount),
    currency: row.currency,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    gateway: row.gateway,
    mode: row.mode,
    orderId: row.order_id,
    paymentId: row.payment_id,
    status: row.status,
    rawResponse: row.raw_response || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function create(data) {
  const result = await query(
    `INSERT INTO payments (
      id, plan, amount, currency, customer_name, customer_email, gateway, mode, order_id, payment_id, status, raw_response
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      crypto.randomUUID(),
      data.plan,
      data.amount,
      data.currency || "INR",
      data.customerName || "Guest",
      data.customerEmail || "",
      data.gateway || "razorpay",
      data.mode || "demo",
      data.orderId,
      data.paymentId || "",
      data.status || "created",
      JSON.stringify(data.rawResponse || {})
    ]
  );

  return mapPayment(result.rows[0]);
}

async function updateByOrderId(orderId, data) {
  const result = await query(
    `UPDATE payments
      SET status = COALESCE($2, status),
          payment_id = COALESCE($3, payment_id),
          raw_response = COALESCE($4::jsonb, raw_response),
          updated_at = NOW()
      WHERE order_id = $1
      RETURNING *`,
    [
      orderId,
      data.status || null,
      data.paymentId || null,
      data.rawResponse ? JSON.stringify(data.rawResponse) : null
    ]
  );

  return mapPayment(result.rows[0]);
}

module.exports = {
  create,
  updateByOrderId
};
