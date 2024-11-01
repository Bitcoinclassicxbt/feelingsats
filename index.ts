import dotenv from "dotenv";
dotenv.config();

import { runIndexer } from "./src/indexer";
import { createApiServer } from "./src/api";
import { databaseConnection } from "./src/database";

import { log } from "./src/utils";

const requiredEnvFields = [
  "DB_USER",
  "DB_PASSWORD",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "RPC_BASE_URL",
  "API_PORT",
  "USE_RATE_LIMIT",
];

const start = async () => {
  if (requiredEnvFields.some((field) => !process.env[field])) {
    log(
      "Missing required environment variables, please define: \n " +
        requiredEnvFields.join("\n "),
      "error"
    );
    return;
  }

  const models = await databaseConnection(process.argv.includes("-new"));

  if (process.argv.includes("-indexer")) {
    runIndexer(models);
  }

  if (process.argv.includes("-api")) {
    createApiServer(models);
  }
};

start();
