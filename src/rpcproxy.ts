import http from "http";
import httpProxy from "http-proxy";
import fs from "fs";
import path from "path";
import { Models } from "./database";
import { checkEnvForFields } from "./utils";
import net from "net";
import { URL } from "url";
import axios, { AxiosError } from "axios";

const requiredEnvFields = [
  "NODE_RPC_URL",
  "NODE_RPC_COOKIE_PATH",
  "HTTP_PROXY_PORT",
  "TCP_PROXY_PORT",
];

export const createRpcProxy = (db: Models) => {
  if (!checkEnvForFields(requiredEnvFields, "rpcproxy")) {
    return;
  }

  const COOKIE_FILE_PATH = path.resolve(
    process.env.NODE_RPC_COOKIE_PATH! || "/root/.luckycoin/.cookie"
  );

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

  const AUTH_HEADER = getAuthHeader(COOKIE_FILE_PATH);
  const NODE_RPC_URL = process.env.NODE_RPC_URL! || "http://127.0.0.1:19918";

  // Create an HTTP proxy server
  const proxy = httpProxy.createProxyServer({
    target: NODE_RPC_URL,
    changeOrigin: true,
    ws: true, // Enable proxying of WebSocket connections if needed
  });

  // Intercept the proxy request to modify headers
  proxy.on("proxyReq", (proxyReq, req, res) => {
    // Replace the Authorization header
    proxyReq.setHeader("Authorization", AUTH_HEADER);
  });

  proxy.on("error", (err, req, res) => {
    console.error("Proxy error:", err);

    if (res instanceof http.ServerResponse && !res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain");
      res.end("Proxy server error");
    }
  });

  // Create an HTTP server that uses the proxy
  const server = http.createServer((req, res) => {
    proxy.web(req, res);
  });

  // Handle WebSocket connections if necessary
  server.on("upgrade", (req, socket, head) => {
    proxy.ws(req, socket, head);
  });

  const HTTP_PORT = process.env.HTTP_PROXY_PORT || 9922;
  server.listen(HTTP_PORT, () => {
    console.log(`HTTP proxy server running on port ${HTTP_PORT}`);
    console.log(`Using cookie file at: ${COOKIE_FILE_PATH}`);
  });

  // Create a TCP server for TCP connections
  const TCP_PORT = process.env.TCP_PROXY_PORT || 9923;
  const tcpServer = net.createServer((clientSocket) => {
    let dataBuffer = "";

    clientSocket.on("data", (chunk) => {
      dataBuffer += chunk.toString();
    });

    clientSocket.on("end", async () => {
      // The client has finished sending data
      // Extract the body of the request
      const headerEndIndex = dataBuffer.indexOf("\r\n\r\n");
      let bodyPart = "";

      if (headerEndIndex !== -1) {
        bodyPart = dataBuffer.substring(headerEndIndex + 4);
      } else {
        // No headers found, assume entire data is body
        bodyPart = dataBuffer;
      }

      // Send the request to the RPC server using axios
      try {
        console.log("posting -> ");
        console.log(bodyPart);
        const response = await axios.post(NODE_RPC_URL, bodyPart, {
          headers: {
            "Content-Type": "application/json",
            Authorization: AUTH_HEADER,
          },
          responseType: "arraybuffer", // Ensure we get raw data
        });
        console.log(response.data);

        // Send the response back to the TCP client
        clientSocket.write(response.data);
        clientSocket.end();
      } catch (error) {
        console.error(
          `Error making request to RPC server: ${
            (error as AxiosError)?.message
          }`
        );
        clientSocket.destroy();
      }
    });

    clientSocket.on("error", (err) => {
      console.error("Client socket error:", err);
    });
  });

  tcpServer.listen(TCP_PORT, () => {
    console.log(`TCP proxy server running on port ${TCP_PORT}`);
  });
};
