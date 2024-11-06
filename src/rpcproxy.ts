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
  proxy.on("proxyReq", (proxyReq, req, res, options) => {
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
      console.log("New connection on tcp");
      dataBuffer += chunk.toString();

      // Detect end of HTTP headers (simplified for this example)
      const headerEndIndex = dataBuffer.indexOf("\r\n\r\n");

      console.log(headerEndIndex);
      console.log(dataBuffer);
      if (headerEndIndex !== -1) {
        return;
      }
      // Split headers and body
      const headersPart = dataBuffer.substring(0, headerEndIndex);
      const bodyPart = dataBuffer.substring(headerEndIndex + 4);

      // Extract Content-Length
      const headersLines = headersPart.split("\r\n");
      let contentLength = 0;
      headersLines.forEach((line) => {
        if (/^Content-Length:/i.test(line)) {
          contentLength = parseInt(line.split(":")[1].trim(), 10);
        }
      });

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

      console.dir(options);

      // Send the request to the RPC server
      const req = http.request(options, (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          console.log(responseData);
          // Send the response back to the TCP client
          clientSocket.write(responseData);
          clientSocket.end();
        });
      });

      req.on("error", (e) => {
        console.error(`Problem with request: ${e.message}`);
        clientSocket.destroy();
      });

      // Write the body to the request
      req.write(bodyPart);
      req.end();

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
