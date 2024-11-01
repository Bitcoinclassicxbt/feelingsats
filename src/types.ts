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

export type UTXODeleteKey = {
  txid: string;
  vout: number;
};

export type BlockData = {
  hash: string;
  confirmations: number;
  strippedsize: number;
  size: number;
  weight: number;
  height: number;
  version: number;
  versionHex: string;
  merkleroot: string;
  tx: Transaction[];
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
