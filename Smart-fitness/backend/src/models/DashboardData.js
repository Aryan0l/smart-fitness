const crypto = require("crypto");
const { query } = require("../db/pool");

function mapDashboardData(row) {
  return {
    id: row.id,
    user: row.user_id,
    eventType: row.event_type,
    label: row.label,
    payload: row.payload || {},
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function create(data) {
  const result = await query(
    `INSERT INTO dashboard_data (id, user_id, event_type, label, payload, source)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
    [
      crypto.randomUUID(),
      data.user,
      data.eventType,
      data.label,
      JSON.stringify(data.payload || {}),
      data.source || "dashboard"
    ]
  );

  return mapDashboardData(result.rows[0]);
}

async function findRecentByUser(userId, limit = 10) {
  const result = await query(
    "SELECT * FROM dashboard_data WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    [userId, limit]
  );

  return result.rows.map(mapDashboardData);
}

module.exports = {
  create,
  findRecentByUser
};
