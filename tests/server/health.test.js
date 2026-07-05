/**
 * Smoke test — confirms the Express app boots and responds without
 * needing a live MongoDB connection (server/index.js only connects/listens
 * when run directly, see the require.main guard).
 */

const request = require("supertest");
const app = require("../../server/index");

test("GET /api/health returns ok", async () => {
  const res = await request(app).get("/api/health");
  expect(res.status).toBe(200);
  expect(res.body.status).toBe("ok");
});
