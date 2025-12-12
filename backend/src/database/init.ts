import path from "path";
import { TradingDatabase } from "./Database";

/**
 * Initialize database
 * Run with: npm run db:init --workspace=backend
 */
async function initializeDatabase() {
  const dbPath = path.join(__dirname, "../../data/trades.db");

  console.log("Initializing database...");
  console.log(`Database path: ${dbPath}`);

  const db = new TradingDatabase(dbPath);

  console.log("✅ Database initialized successfully");
  console.log("\nTables created:");
  console.log("  - trades");
  console.log("  - orders");
  console.log("  - positions");
  console.log("  - equity_snapshots");
  console.log("  - logs");
  console.log("  - signals");

  db.close();
  console.log("\nDatabase ready for use");
}

initializeDatabase().catch((error) => {
  console.error("❌ Failed to initialize database:", error);
  process.exit(1);
});
