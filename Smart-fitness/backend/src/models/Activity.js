const crypto = require("crypto");
const { query } = require("../db/pool");

function mapActivity(row) {
  return {
    id: row.id,
    user: row.user_id,
    action: row.action,
    detail: row.detail,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function create(data) {
  const result = await query(
    `INSERT INTO activities (id, user_id, action, detail, category)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
    [crypto.randomUUID(), data.user, data.action, data.detail, data.category || "general"]
  );

  return mapActivity(result.rows[0]);
}

async function findRecentByUser(userId, limit = 6) {
  const result = await query(
    "SELECT * FROM activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    [userId, limit]
  );

  return result.rows.map(mapActivity);
}

module.exports = {
  create,
  findRecentByUser
};
