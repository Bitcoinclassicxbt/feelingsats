import express, { Request, Response } from "express";
import { getBlock } from "../blockchain";
import { BlockData, FullTransaction } from "../types";
import { getCirculatingSupply } from "../utils/totalSupply";

export const BlockRouter = express.Router();

BlockRouter.get("/circulating-supply", (req: Request, res: Response) => {
  const circulatingSupply = getCirculatingSupply();

  res.json({ circulatingSupply });
});

BlockRouter.get("/:blocknumber", async (req: Request, res: Response) => {
  try {
    if (isNaN(Number(req.params.blocknumber))) {
      res.status(400).json({ error: "Invalid block number" });
      return;
    }

    const block: BlockData<FullTransaction> = await getBlock(
      parseInt(req.params.blocknumber)
    );
    res.json(block);
  } catch (e) {
    console.log(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

BlockRouter.get("/address/request/");

export default BlockRouter;
