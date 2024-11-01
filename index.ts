import dotenv from "dotenv";
dotenv.config();

import { runIndexer } from "./src/indexer";

const start = async () => {
  if (process.argv.includes("-indexer")) {
    runIndexer();
    return;
  }
};

start();
