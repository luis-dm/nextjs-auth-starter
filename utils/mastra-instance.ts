import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";

// Create a shared Mastra instance with PostgreSQL storage
export const mastra = new Mastra({
  storage: new PostgresStore({
    id: "bim-assistant",
    connectionString: process.env.DATABASE_URL!,
  }),
});
