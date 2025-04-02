import fs from "fs";
import path from "path";
import axios from "axios";
import { BlockData, Transaction } from "./types";
import { Transaction as BitcoinJsTransaction } from "bitcoinjs-lib";
import { FullTransaction, FullAPIError } from "./types";

export const XbtNetwork = {
  messagePrefix: "\u0018Xbt Signed Message:\n",
  bech32: "bc1",
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 0,
  scriptHash: 5,
  wif: 128,
};

// ✅ Utility: Read cookie and return auth header
const getCookieAuthHeader = (): string => {
  const cookiePath = process.env.RPC_COOKIE_PATH ?? "/root/.bitcoin/.cookie";
  const cookie = fs.readFileSync(path.resolve(cookiePath), "utf8").trim();
  const encoded = Buffer.from(cookie).toString("base64");
  return `Basic ${encoded}`;
};

export const txJsonToHex = (tx: Transaction): string => {
  const transaction = new BitcoinJsTransaction();

  transaction.version = tx.version;
  transaction.locktime = tx.locktime;

  tx.vin.forEach((input) => {
    if (input.coinbase) {
      transaction.addInput(
        Buffer.alloc(32),
        0xffffffff,
        0xffffffff,
        Buffer.from(input.coinbase, "hex")
      );
      return;
    }

    const txidBuffer = Buffer.from(input.txid, "hex").reverse();
    const scriptSigBuffer = Buffer.from(input.scriptSig.hex, "hex");

    const vinIndex = transaction.addInput(
      txidBuffer,
      input.vout,
      input.sequence
    );

    transaction.ins[vinIndex].script = scriptSigBuffer;
  });

  tx.vout.forEach((output) => {
    const scriptPubKeyBuffer = Buffer.from(output.scriptPubKey.hex, "hex");
    const valueSatoshis = Math.round(output.value * 1e8);
    transaction.addOutput(scriptPubKeyBuffer, BigInt(valueSatoshis));
  });

  return transaction.toHex();
};

export const getBlock = async (
  blockNumber: number
): Promise<BlockData<FullTransaction>> => {
  const rpcBaseURL = process.env.RPC_BASE_URL;
  if (!rpcBaseURL) {
    throw new Error("RPC_BASE_URL is not defined");
  }

  const auth = getCookieAuthHeader();

  try {
    const { data: blockHashResponse } = await axios.post(
      rpcBaseURL,
      {
        jsonrpc: "1.0",
        id: "getblockhash",
        method: "getblockhash",
        params: [blockNumber],
      },
      {
        headers: {
          Authorization: auth,
        },
      }
    );

    const blockHash = blockHashResponse.result;
    if (!blockHash) throw new Error("Failed to retrieve block hash");

    const { data: blockResponse } = await axios.post(
      rpcBaseURL,
      {
        jsonrpc: "1.0",
        id: "getblock",
        method: "getblock",
        params: [blockHash, true],
      },
      {
        headers: {
          Authorization: auth,
        },
      }
    );

    if (!blockResponse.result) {
      throw new Error("Failed to retrieve block data.");
    }

    const blockData = blockResponse.result;

    console.log(blockData);

    blockData.tx = (await Promise.all(
      blockData.tx.map((txid: string) =>
        axios.post(
          rpcBaseURL,
          {
            jsonrpc: "1.0",
            id: "getrawtransaction",
            method: "getrawtransaction",
            params: [txid, true],
          },
          {
            headers: {
              Authorization: auth,
            },
          }
        )
      )
    )) as FullTransaction[];

    blockData.tx = blockData.tx.map((tx: Transaction) => ({
      ...tx,
      rawHex: txJsonToHex(tx),
    }));

    return blockData as BlockData<FullTransaction>;
  } catch (e: unknown) {
    console.error("Error fetching block data:", e);
    throw (
      "Error fetching block " +
      JSON.stringify((e as FullAPIError)?.response?.data ?? {})
    );
  }
};

export const pushTx = async (
  signedTransactionHex: string
): Promise<{ txid: Transaction["txid"] }> => {
  const rpcBaseURL = process.env.RPC_BASE_URL;

  if (!rpcBaseURL) {
    throw new Error("RPC_BASE_URL is not defined");
  }

  const auth = getCookieAuthHeader();

  try {
    const { data } = await axios.post(
      rpcBaseURL,
      {
        jsonrpc: "1.0",
        id: "sendrawtransaction",
        method: "sendrawtransaction",
        params: [signedTransactionHex],
      },
      {
        headers: {
          Authorization: auth,
        },
      }
    );

    return { txid: data.result };
  } catch (e: unknown) {
    throw (
      "Internal server error " +
      JSON.stringify((e as FullAPIError)?.response?.data ?? {})
    );
  }
};
