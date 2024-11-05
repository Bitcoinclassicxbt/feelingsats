import net from "net";
import axios from "axios";
import fs from "fs";
import path from "path";
import { checkEnvForFields } from "./utils";

const requiredEnvFields = [
  "NODE_RPC_URL",
  "NODE_RPC_COOKIE_PATH",
  "PROXY_PORT",
];

export const createRpcProxy = () => {
  if (!checkEnvForFields(requiredEnvFields, "rpcproxy")) {
    return;
  }

  const COOKIE_FILE_PATH = path.resolve(
    process.env.NODE_RPC_COOKIE_PATH! || "/root/.luckycoin/.cookie"
  );
  const cookie = fs.readFileSync(COOKIE_FILE_PATH, "utf-8").trim();
  const AUTH_HEADER = `Basic ${Buffer.from(cookie).toString("base64")}`;
  const NODE_RPC_URL = process.env.NODE_RPC_URL! || "http://127.0.0.1:19918";
  const PORT = parseInt(process.env.PROXY_PORT || "9920", 10);

  const server = net.createServer((socket) => {
    let requestData = "";

    socket.on("data", (chunk) => {
      requestData += chunk.toString();

      // Check if we have received all the data
      const headersEndIndex = requestData.indexOf("\n\n");
      if (headersEndIndex !== -1) {
        const headersPart = requestData.substring(0, headersEndIndex);
        const bodyPart = requestData.substring(headersEndIndex + 2);

        // Parse Content-Length to ensure we've received the full body
        const contentLengthMatch = headersPart.match(/Content-Length: (\d+)/i);
        if (contentLengthMatch) {
          const contentLength = parseInt(contentLengthMatch[1], 10);
          if (bodyPart.length >= contentLength) {
            // We have received the full request
            handleRequest(socket, headersPart, bodyPart);
          }
        }
      }
    });

    socket.on("error", (err) => {
      console.error("Socket error:", err);
      socket.destroy();
    });
  });

  server.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
    console.log(`Using cookie file at: ${COOKIE_FILE_PATH}`);
  });

  async function handleRequest(
    socket: net.Socket,
    headersPart: string,
    bodyPart: string
  ) {
    try {
      // Parse the request line and headers
      const headersLines = headersPart.split("\n");
      const requestLine = headersLines.shift()!;
      const [method, path, httpVersion] = requestLine.split(" ");
      const headers: { [key: string]: string } = {};
      for (const line of headersLines) {
        const [key, value] = line.split(": ");
        if (key && value) {
          headers[key.toLowerCase()] = value.trim();
        }
      }

      // Get the Authorization header
      const authHeader = headers["authorization"];

      // Verify the Authorization header
      if (!authHeader || authHeader !== AUTH_HEADER) {
        const responseMessage = "HTTP/1.1 401 Unauthorized\n\n";
        socket.write(responseMessage);
        socket.end();
        return;
      }

      // Forward the request to the Bitcoin node
      const response = await axios.post(NODE_RPC_URL, bodyPart, {
        headers: {
          Authorization: AUTH_HEADER,
          "Content-Type": "application/json",
        },
      });

      // Prepare the response to send back
      const responseBody = JSON.stringify(response.data);
      const responseMessage = `HTTP/1.1 200 OK\nContent-Length: ${responseBody.length}\n\n${responseBody}`;

      socket.write(responseMessage);
      socket.end();
    } catch (error) {
      console.error("Error handling request:", error);
      let statusLine = "HTTP/1.1 500 Internal Server Error";
      let responseBody = JSON.stringify({ error: "Proxy server error" });

      if (axios.isAxiosError(error) && error.response) {
        statusLine = `HTTP/1.1 ${error.response.status} ${error.response.statusText}`;
        responseBody = JSON.stringify(error.response.data);
      }

      const responseMessage = `${statusLine}\nContent-Length: ${responseBody.length}\n\n${responseBody}`;
      socket.write(responseMessage);
      socket.end();
    }
  }
};
