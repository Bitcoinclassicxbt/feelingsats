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
export const TxJsonToHex = (tx: Transaction): string => {
  const transaction = new BitcoinJsTransaction();

  // Set transaction version and locktime
  transaction.version = tx.version;
  transaction.locktime = tx.locktime;

  // Add inputs
  tx.vin.forEach((input) => {
    if (input.coinbase) {
      // Coinbase transaction input handling
      transaction.addInput(
        Buffer.alloc(32), // Empty previous txid for coinbase
        0xffffffff, // Coinbase index
        0xffffffff, // Sequence number for coinbase transactions
        Buffer.from(input.coinbase, "hex") // Coinbase data as scriptSig
      );
      return;
    }

    const txidBuffer = Buffer.from(input.txid, "hex").reverse();
    const scriptSigBuffer = Buffer.from(input.scriptSig.hex, "hex");

    // Add the input without scriptSig first
    const vinIndex = transaction.addInput(
      txidBuffer,
      input.vout,
      input.sequence
    );

    // Now set the scriptSig directly
    transaction.ins[vinIndex].script = scriptSigBuffer;
  });

  // Add outputs
  tx.vout.forEach((output) => {
    const scriptPubKeyBuffer = Buffer.from(output.scriptPubKey.hex, "hex");
    const valueSatoshis = Math.round(output.value * 1e8); // Convert BTC to satoshis
    transaction.addOutput(scriptPubKeyBuffer, BigInt(valueSatoshis));
  });

  // Return raw transaction hex
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
  try {
    const { data } = (await axios.get(
      `${process.env.RPC_BASE_URL}/getblock/${blockNumber}`
    )) as APIResponse<BlockData<Transaction>>;

    if (isAPIError(data)) {
      throw (
        "Error fetching block " +
        JSON.stringify((data as APIError)?.error ?? {})
      );
    }
    //Data is not an error, so we can safely cast it to BlockData<Transaction>

    data.tx = data.tx.map((tx: Transaction) => ({
      ...tx,
      rawHex: TxJsonToHex(tx),
    }));

    return data as BlockData<FullTransaction>;
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
