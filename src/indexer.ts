import { getBlock } from "./blockchain";
import { BlockData, UTXO, UTXODeleteKey } from "./types";
import { databaseConnection, Models } from "./database/createConnection";
import { Op } from "sequelize";
import { sleep, log } from "./utils";

const getLastProcessedBlock = async (models: Models) => {
  const { Setting } = models;

  const [setting, created] = await Setting.findOrCreate({
    where: {
      key: "last_processed_block",
    },
    defaults: {
      key: "last_processed_block",
      value: "-1", // Set to -1 to start from block 0
    },
  });

  return setting.value;
};

const setLastProcessedBlock = async (models: Models, blockNum: number) => {
  const { Setting } = models;

  await Setting.upsert({
    key: "last_processed_block",
    value: blockNum.toString(),
  });
};

const getNewUtxosFromBlock = (block: BlockData): UTXO[] => {
  const utxos: UTXO[] = [];

  for (const transaction of block.tx) {
    for (const vout of transaction.vout) {
      utxos.push({
        txid: transaction.txid,
        vout: vout.n,
        address: vout.scriptPubKey?.addresses?.[0] ?? "",
        amount: BigInt(Math.round(vout.value * 1e8)),
        hex: vout.scriptPubKey.hex,
        block: block.height,
        block_hash: block.hash,
      });
    }
  }

  return utxos;
};

const getUsedUtxosFromBlock = (block: BlockData): UTXODeleteKey[] => {
  const utxos: UTXODeleteKey[] = [];

  for (const transaction of block.tx) {
    for (const vin of transaction.vin) {
      if (vin.coinbase) {
        continue;
      }

      utxos.push({
        txid: vin.txid,
        vout: vin.vout,
      });
    }
  }

  return utxos;
};

type UpdateBlockArgs = {
  add_utxos: UTXO[];
  delete_utxos: UTXODeleteKey[];
};

const createBlockArgs = async (blockNum: number): Promise<UpdateBlockArgs> => {
  const block: BlockData = await getBlock(blockNum);

  return {
    add_utxos: getNewUtxosFromBlock(block),
    delete_utxos: getUsedUtxosFromBlock(block),
  };
};

export const runIndexer = async () => {
  const models = await databaseConnection();
  console.log("Connected!");

  // Retrieve the last processed block once
  const lastProcessedBlock = await getLastProcessedBlock(models);
  let currentBlockNum = Number(lastProcessedBlock) + 1; // Start from the next block

  while (true) {
    try {
      log(`Processing block ${currentBlockNum}...`);
      const blockargs = await createBlockArgs(currentBlockNum);

      if (blockargs.add_utxos.length > 0) {
        await models.Utxo.bulkCreate(blockargs.add_utxos);
      }

      if (blockargs.delete_utxos.length > 0) {
        await models.Utxo.destroy({
          where: {
            [Op.or]: blockargs.delete_utxos.map((utxo) => ({
              txid: utxo.txid,
              vout: utxo.vout,
            })),
          },
        });
      }

      await setLastProcessedBlock(models, currentBlockNum);

      // Increment the block number for the next iteration
      currentBlockNum++;
    } catch (error) {
      log(`Error processing block ${currentBlockNum}: ${error}`);
      log("Waiting for new blocks...");

      // Wait for new blocks using sleep from ./utils
      while (true) {
        await sleep(500); // Sleep for 60 seconds
        try {
          const block: BlockData = await getBlock(currentBlockNum + 1);
          if (block) {
            break;
          }
        } catch (e) {} //this is guaranteed to fail (we are actually checking if theres a failure to see if the block is there)
      }
    }
  }
};
