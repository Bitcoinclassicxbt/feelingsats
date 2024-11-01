import express, { Request, Response } from "express";
import { UTXO } from "../types";
import { Models } from "../database";
import { binarySearchForLowest } from "../utils";

export const UtxoRouter = express.Router();

// Example route handlers

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

UtxoRouter.get(
  "/all_by_address/:address",
  async (req: Request, res: Response) => {
    try {
      res.json(await fetchUtxosForAddress(req.params.address, req.models));
    } catch (e) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

UtxoRouter.get(
  "/fetch_by_address/:address/:amount",
  async (req: Request, res: Response) => {
    try {
      if (isNaN(Number(req.params.amount))) {
        res.status(400).json({ error: "Invalid amount" });
        return;
      }

      const addressUtxos = await fetchUtxosForAddress(
        req.params.address,
        req.models
      );

      if (addressUtxos.length === 0) {
        res.json({ error: "No UTXOs found" });
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

      if (endIndex > 0) {
        res.json(addressUtxos.slice(endIndex - 1, closestIndex));
        return;
      }

      if (endIndex === -1 && closestIndex !== addressUtxos.length - 1) {
        res.json([addressUtxos[closestIndex + 1]]);
        return;
      }
      res.json({ error: "No UTXOs found" });
    } catch (e) {
      console.log(e);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default UtxoRouter;
