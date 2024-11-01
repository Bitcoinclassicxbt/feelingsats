import express, { Request, Response } from "express";
import { UTXO } from "../types";
import { Models } from "../database";
import { pushTx } from "../blockchain";

export const TransactionRouter = express.Router();

TransactionRouter.get(
  "/broadcast/:signedtxhex",
  async (req: Request, res: Response) => {
    try {
      res.json(await pushTx(req.params.signedtxhex));
    } catch (e) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default TransactionRouter;
