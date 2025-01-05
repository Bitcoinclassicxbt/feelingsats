import express, { Request, Response } from "express";
import { Op } from "sequelize";
import { Models } from "../database";
import { UTXO } from "../types";
import { binarySearchForLowest } from "../utils";
import { getHolders, IHolder } from "../utils/holders";
export const AddressRouter = express.Router();

const fetchUtxosForAddress = async (
  address: string,
  models: Models
): Promise<UTXO[]> => {
  return await models.Utxo.findAll({
    where: {
      address: address,
    },
    attributes: {
      exclude: ["id", "createdAt", "updatedAt"],
    },
    order: [["amount", "ASC"]],
    raw: true,
  });
};

AddressRouter.get("/sorted-by-balance", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = (page - 1) * limit;

    const allHolders: IHolder[] = req.global.holders;

    res.json({ page, data: allHolders.slice(offset, offset + limit) });
  } catch (e) {
    console.log(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

AddressRouter.get("/:address/balance", async (req: Request, res: Response) => {
  try {
    const address = req.params.address;

    const utxos = await fetchUtxosForAddress(address, req.models);

    const balance = utxos.reduce((acc, utxo) => acc + Number(utxo.amount), 0);

    res.json({ balance: balance / 1e8 });
  } catch (e) {
    console.log(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

AddressRouter.get(
  "/:address/transactions",
  async (req: Request, res: Response) => {
    try {
      const address = req.params.address;

      const data = await req.models.Transaction.findAll({
        where: {
          [Op.or]: [
            {
              vin: {
                [Op.contains]: [address],
              },
            },
            {
              vout: {
                [Op.contains]: [address],
              },
            },
          ],
        },
      });

      res.json(data);
    } catch (e) {
      console.log(e);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

AddressRouter.get("/:address/utxos", async (req: Request, res: Response) => {
  try {
    res.json(await fetchUtxosForAddress(req.params.address, req.models));
  } catch (e) {
    res.json({ error: "Internal server error" });
  }
});

AddressRouter.get(
  "/:address/utxos/:amount",
  async (req: Request, res: Response) => {
    try {
      if (isNaN(Number(req.params.amount))) {
        res.json({ error: "Invalid amount" });
        return;
      }

      const addressUtxos = await fetchUtxosForAddress(
        req.params.address,
        req.models
      );

      if (addressUtxos.length === 0) {
        res.json([]);
        return;
      }

      const closestIndex = binarySearchForLowest<UTXO>(
        addressUtxos,
        "amount",
        0,
        addressUtxos.length - 1,
        req.params.amount
      );

      //If we cant find a smaller utxo than amount requested, we can guarantee that the first utxo is the best one to use

      if (closestIndex === -1) {
        res.json([addressUtxos[0]]);
        return;
      }

      let totalRecoupedValue = 0n;
      let endIndex = closestIndex;
      while (totalRecoupedValue < BigInt(req.params.amount) && endIndex >= 0) {
        totalRecoupedValue += BigInt(addressUtxos[endIndex].amount);
        endIndex--;
      }

      if (totalRecoupedValue >= BigInt(req.params.amount)) {
        res.json(addressUtxos.slice(endIndex + 1, closestIndex + 1));
        return;
      }

      if (addressUtxos[closestIndex + 1]) {
        res.json([addressUtxos[closestIndex + 1]]);
        return;
      }
      res.json([]);
    } catch (e) {
      console.log(e);
      res.json({ error: "Internal server error" });
    }
  }
);

export default AddressRouter;
