import net from "net";
import fs from "fs";
import path from "path";
import express, { Request, Response } from "express";
import { Models } from "./database";
import { checkEnvForFields } from "./utils";

const app = express();
app.use(express.json());

// Function to read and encode the cookie file
function getAuthHeader(cookieFilePath: string): string {
  try {
    const cookie = fs.readFileSync(cookieFilePath, "utf-8").trim();
    return `Basic ${Buffer.from(cookie).toString("base64")}`;
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

  const COOKIE_FILE_PATH = path.resolve(
    process.env.NODE_RPC_COOKIE_PATH! || "/root/.luckycoin/.cookie"
  );
  const AUTH_HEADER = getAuthHeader(COOKIE_FILE_PATH);

  // Parse the NODE_RPC_URL to get the hostname and port
  const NODE_RPC_URL = process.env.NODE_RPC_URL || "127.0.0.1:19918";
  const [host, port] = NODE_RPC_URL.replace("http://", "").split(":");

  app.post("/", (req: Request, res: Response) => {
    // Serialize the request body for TCP (this may vary based on your RPC server’s expectations)
    const requestData = JSON.stringify(req.body);

    const client = new net.Socket();
    let responseData = "";

    client.connect(parseInt(port), host, () => {
      console.log(`Connected to ${host}:${port}`);
      client.write(`${AUTH_HEADER}\n${requestData}\n`);
    });

    client.on("data", (data) => {
      responseData += data.toString();
    });

    client.on("end", () => {
      try {
        const jsonResponse = JSON.parse(responseData);
        res.status(200).json(jsonResponse);
      } catch (error) {
        console.error("Failed to parse JSON response:", error);
        res.status(500).json({ error: "Invalid response from server" });
      }
      client.destroy();
    });

    client.on("error", (error) => {
      console.error("TCP connection error:", error);
      res.status(500).json({ error: "Proxy server error" });
    });
  });

  const PORT = process.env.PROXY_PORT || 9920;
  app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
    console.log(`Using cookie file at: ${COOKIE_FILE_PATH}`);
  });
};
