import http from "http";
import httpProxy from "http-proxy";
import fs from "fs";
import path from "path";
import { Models } from "./database";
import { checkEnvForFields } from "./utils";
import net from "net";
import { URL } from "url";

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

  // Parse the NODE_RPC_URL to extract host and port
  const parsedUrl = new URL(NODE_RPC_URL);
  const targetHost = parsedUrl.hostname;
  const targetPort =
    parseInt(parsedUrl.port, 10) ||
    (parsedUrl.protocol === "https:" ? 443 : 80);

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
      console.log("new connection");
      dataBuffer += chunk.toString();

      // Detect end of HTTP headers
      const headerEndIndex = dataBuffer.indexOf("\r\n\r\n");
      if (headerEndIndex !== -1) {
        return;
      }
      // Extract the body of the request
      const bodyPart = dataBuffer.substring(headerEndIndex + 4);

      // Prepare options for the HTTP request to the RPC server
      const options = {
        hostname: targetHost,
        port: targetPort,
        path: "/",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyPart),
          Authorization: AUTH_HEADER,
        },
      };
      console.log("options");

      // Send the request to the RPC server
      const req = http.request(options, (res) => {
        // Pipe the RPC server response back to the TCP client
        res.pipe(clientSocket);
      });

      req.on("error", (e) => {
        console.error(`Problem with request: ${e.message}`);
        clientSocket.destroy();
      });

      // Send the body and end the request
      console.log(bodyPart);
      req.end(bodyPart);

      // Clear the buffer
      dataBuffer = "";
    });

    clientSocket.on("error", (err) => {
      console.error("Client socket error:", err);
    });
  });

  tcpServer.listen(TCP_PORT, () => {
    console.log(`TCP proxy server running on port ${TCP_PORT}`);
  });
};
