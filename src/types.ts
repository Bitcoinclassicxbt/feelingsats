export type FullAPIError = { response: { data: string } };
export const isAPIError = (data: unknown): data is APIError => {
  return (data as APIError)?.error !== undefined;
};

export type APIResponse<T> = { data: T | APIError };

export type APIError = {
  error: {
    code: number;
    message: string;
  };
};

export type Setting = {
  key: string;
  value: string;
};

export type UTXO = {
  txid: string;
  vout: number;
  address: string;
  amount: bigint;
  hex: string;
  block: number;
  block_hash: string;
};

export type APIUTXO = Omit<UTXO, "amount"> & { amount: string };

export type UTXODeleteKey = {
  txid: string;
  vout: number;
};

export type BlockData<T extends Transaction | FullTransaction> = {
  hash: string;
  confirmations: number;
  strippedsize: number;
  size: number;
  weight: number;
  height: number;
  version: number;
  versionHex: string;
  merkleroot: string;
  tx: T[];
  time: number;
  mediantime: number;
  nonce: number;
  bits: string;
  difficulty: number;
  chainwork: string;
  nextblockhash?: string;
};

export type Transaction = {
  txid: string;
  hash: string;
  size: number;
  vsize: number;
  version: number;
  locktime: number;
  vin: Vin[];
  vout: Vout[];
};

export type Vin = {
  txid: string;
  vout: number;
  scriptSig: ScriptSig;
  coinbase?: string;
  sequence: number;
};

export type Vout = {
  value: number;
  n: number;
  scriptPubKey: ScriptPubKey;
};

export type ScriptPubKey = {
  asm: string;
  hex: string;
  reqSigs?: number;
  type: string;
  addresses?: string[];
};

export type ScriptSig = {
  asm: string;
  hex: string;
};

export type FullTransaction = Transaction & {
  rawHex: string;
};
