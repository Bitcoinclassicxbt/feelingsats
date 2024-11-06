import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import { Models } from "./database";
import { checkEnvForFields } from "./utils";
const app = express();
app.use(express.json());

// Function to read and encode the cookie file
function getAuthHeader(cookieFilePath: string): string {
  try {
    const cookie = fs.readFileSync(cookieFilePath, "utf-8").trim();
    return `Basic ${btoa(cookie)}`;
  } catch (error) {
    console.error("Error reading the cookie file:", error);
    process.exit(1);
  }
}
const requiredEnvFields = [
  "NODE_RPC_URL",
  "NODE_RPC_COOKIE_PATH",
  "PROXY_PORT",
];
export const createRpcProxy = (db: Models) => {
  if (!checkEnvForFields(requiredEnvFields, "rpcproxy")) {
    return;
  }

  //checkEnvForFields verifies NODE_RPC_COOKIE_PATH is defined
  const COOKIE_FILE_PATH = path.resolve(
    process.env.NODE_RPC_COOKIE_PATH! || "/root/.luckycoin/.cookie"
  );
  const AUTH_HEADER = getAuthHeader(COOKIE_FILE_PATH);
  const NODE_RPC_URL = process.env.NODE_RPC_URL! || "http://127.0.0.1:19918";

  app.post("*", async (req: Request, res: Response) => {
    try {
      console.log(req.body);
      console.log(req.headers);

      const response = await axios.post(NODE_RPC_URL, req.body, {
        headers: {
          Authorization: AUTH_HEADER,
          "Content-Type": "text/plain",
        },
      });

      console.log("debug!!!");
      console.log(response.data);
      console.log(response.status);
      res.status(response.status).json(response.data);
    } catch (error) {
      console.log(error);
      if (axios.isAxiosError(error) && error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({ error: "Proxy server error" });
      }
    }
  });

  const PORT = process.env.PROXY_PORT || 9920;
  app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
    console.log(`Using cookie file at: ${COOKIE_FILE_PATH}`);
  });
};
