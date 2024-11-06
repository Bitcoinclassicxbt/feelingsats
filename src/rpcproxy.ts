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

  // Create a proxy server
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

    // Check if res is a ServerResponse and not a Socket
    if (res instanceof http.ServerResponse) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain");
        res.end("Proxy server error");
      }
    } else if (res instanceof net.Socket) {
      // Handle socket-specific error response if necessary
      res.end();
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

  const PORT = process.env.HTTP_PROXY_PORT || 9920;
  server.listen(PORT, () => {
    console.log(`HTTP proxy server running on port ${PORT}`);
    console.log(`Using cookie file at: ${COOKIE_FILE_PATH}`);
  });

  // Create a TCP server for TCP connections
  const TCP_PORT = process.env.TCP_PROXY_PORT || 9921;
  const tcpServer = net.createServer((clientSocket) => {
    let buffer = "";
    let headersParsed = false;

    clientSocket.on("data", (chunk) => {
      buffer += chunk.toString();

      if (!headersParsed) {
        // Check if we've received the end of the HTTP headers
        const headerEndIndex = buffer.indexOf("\r\n\r\n");
        if (headerEndIndex !== -1) {
          headersParsed = true;

          // Extract headers and body
          const headersPart = buffer.substring(0, headerEndIndex);
          const bodyPart = buffer.substring(headerEndIndex + 4); // Skip past \r\n\r\n

          // Split headers into lines
          const headersLines = headersPart.split(/\r\n/);

          // Parse the request line
          const requestLine = headersLines.shift();
          if (!requestLine) {
            console.error("Invalid HTTP request: missing request line");
            clientSocket.destroy();
            return;
          }

          // Parse headers into an object
          const headerObj: { [key: string]: string } = {};
          headersLines.forEach((line) => {
            const index = line.indexOf(":");
            if (index !== -1) {
              const key = line.substring(0, index).trim();
              const value = line.substring(index + 1).trim();
              headerObj[key] = value;
            }
          });

          // Replace the Authorization header
          headerObj["Authorization"] = AUTH_HEADER;

          // Reconstruct the headers
          const modifiedHeaders = [requestLine];
          for (const key in headerObj) {
            modifiedHeaders.push(`${key}: ${headerObj[key]}`);
          }

          const modifiedRequest =
            modifiedHeaders.join("\r\n") + "\r\n\r\n" + bodyPart;

          // Connect to target server
          const targetSocket = net.connect(
            {
              host: targetHost,
              port: targetPort,
            },
            () => {
              // Send the modified request to the target server
              targetSocket.write(modifiedRequest);

              // Pipe remaining data
              clientSocket.pipe(targetSocket);
              targetSocket.pipe(clientSocket);
            }
          );

          targetSocket.on("error", (err) => {
            console.error("Target socket error:", err);
            clientSocket.destroy();
          });

          clientSocket.on("error", (err) => {
            console.error("Client socket error:", err);
            targetSocket.destroy();
          });
        }
      }
    });
  });

  tcpServer.listen(TCP_PORT, () => {
    console.log(`TCP proxy server running on port ${TCP_PORT}`);
  });
};
