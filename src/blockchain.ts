import axios from "axios";
import { BlockData, Transaction, APIError, isAPIError } from "./types";
import { Transaction as BitcoinJsTransaction } from "bitcoinjs-lib";
import { FullTransaction, FullAPIError, APIResponse } from "./types";

export const LuckycoinNetwork = {
  messagePrefix: "\u0018Luckycoin Signed Message:\n",
  bech32: "lky",
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 47,
  scriptHash: 5,
  wif: 176,
};
export const txJsonToHex = (tx: Transaction): string => {
  const transaction = new BitcoinJsTransaction();

  transaction.version = tx.version;
  transaction.locktime = tx.locktime;

  tx.vin.forEach((input) => {
    if (input.coinbase) {
      // Coinbase transactions dont have txid
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

/*

    These call an internal API on the server. If you are running your own version of this you need 
    to create api routes that fullfill these requests (whether through cli util or rpc server, which
    luckycoin doesnt have yet) 

    pushTx -> ./luckycoin-cli sendrawtransaction <hex>
    getblock -> ./luckycoin-cli getblock <hash>
    
*/

export const getBlock = async (
  blockNumber: number
): Promise<BlockData<FullTransaction>> => {
  const rpcBaseURL = process.env.RPC_BASE_URL;
  const rpcUsername = process.env.RPC_USERNAME;
  const rpcPassword = process.env.RPC_PASSWORD;

  if (!rpcBaseURL) {
    throw new Error("RPC_BASE_URL is not defined in the environment variables");
  }

  try {
    // Fetch the block hash first
    const { data: blockHashResponse } = await axios.post(
      rpcBaseURL,
      {
        jsonrpc: "1.0",
        id: "getblockhash",
        method: "getblockhash",
        params: [blockNumber],
      },
      {
        auth: {
          username: rpcUsername,
          password: rpcPassword,
        },
      }
    );

    const blockHash = blockHashResponse.result;
    if (!blockHash) {
      throw new Error("Failed to retrieve block hash.");
    }

    // Fetch the block data using the block hash
    const { data: blockResponse } = await axios.post(
      rpcBaseURL,
      {
        jsonrpc: "1.0",
        id: "getblock",
        method: "getblock",
        params: [blockHash, 2], // The second parameter `2` includes full transactions
      },
      {
        auth: {
          username: rpcUsername,
          password: rpcPassword,
        },
      }
    );

    if (!blockResponse.result) {
      throw new Error("Failed to retrieve block data.");
    }

    const blockData = blockResponse.result;

    // Add `rawHex` to transactions
    blockData.tx = blockData.tx.map((tx: Transaction) => ({
      ...tx,
      rawHex: txJsonToHex(tx),
    }));

    return blockData as BlockData<FullTransaction>;
  } catch (e: unknown) {
    throw (
      "Error fetching block " +
      JSON.stringify((e as FullAPIError)?.response?.data ?? {})
    );
  }
};
export const pushTx = async (
  signedTransactionHex: string
): Promise<APIResponse<{ txid: Transaction["txid"] }>> => {
  try {
    const { data } = await axios.post(`${process.env.RPC_BASE_URL}/pushtx`, {
      txdata: signedTransactionHex,
    });

    return data;
  } catch (e: unknown) {
    throw (
      "Internal server error " +
      JSON.stringify((e as FullAPIError)?.response?.data ?? {})
    );
  }
};
