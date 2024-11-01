import axios from "axios";
import { BlockData } from "./types";

export const getBlock = async (blockNumber: number): Promise<BlockData> => {
  const { data } = await axios.get(
    `${process.env.RPC_BASE_URL}/getblock/${blockNumber}`
  );
  return data;
};
