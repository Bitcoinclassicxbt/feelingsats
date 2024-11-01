import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";
import { Models } from "./database";

const port = process.env.INTERNAL_API_PORT || 3001;
const homeDir = os.homedir();
const binaryPath = `${homeDir}/lky/luckycoin-cli`;

const execFileAsync = promisify(execFile);

async function executeCommand(args: string[]): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(binaryPath, args, {
      shell: false,
      timeout: 10000,
      maxBuffer: 200 * 1024 * 1024,
    });

    const output = stdout.trim();

    if (stderr) {
      throw new Error(stderr.trim());
    }

    if (output.startsWith("error code:")) {
      throw new Error(output);
    }

    return output;
  } catch (error: any) {
    const errorOutput =
      (error.stdout || "") + (error.stderr || "") || error.message;
    const parsedError = parseErrorOutput(errorOutput);
    throw parsedError;
  }
}

function parseErrorOutput(errorOutput: string): {
  message: string;
} {
  const errorMessageMatch = errorOutput.match(/error message:\s*(.*)/s);
  const errorMessage = errorMessageMatch
    ? errorMessageMatch[1].trim()
    : errorOutput || "Unknown error";

  return {
    message: errorMessage,
  };
}

function handleError(error: any) {
  return { error: { message: error.message || "Unknown error" } };
}

export const createInternalApiServer = async (models: Models) => {
  const app = express();
  app.use(bodyParser.json());

  app.post("/pushtx", async (req: Request, res: Response) => {
    const rawtxdata = req.body.txdata;

    if (!rawtxdata || typeof rawtxdata !== "string") {
      res.json({ error: { message: "Invalid raw transaction data" } });
      return;
    }

    const args = ["sendrawtransaction", rawtxdata];

    try {
      const output = await executeCommand(args);
      res.json({ txid: output });
    } catch (error) {
      res.json(handleError(error));
    }
  });

  // /getblock/:number endpoint
  app.get("/getblock/:number", async (req: Request, res: Response) => {
    const blockNumberStr = req.params.number;
    const blockNumber = parseInt(blockNumberStr, 10);

    if (isNaN(blockNumber) || blockNumber < 0) {
      res.json({ error: { message: "Invalid block number" } });
      return;
    }

    try {
      const blockHash = await executeCommand(["getblockhash", blockNumberStr]);
      const blockOutput = await executeCommand(["getblock", blockHash, "2"]);
      const blockData = JSON.parse(blockOutput);

      res.json(blockData);
    } catch (error) {
      res.json(handleError(error));
    }
  });

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};
