import axios from "axios";
import { BlockData } from "./types";

export const getBlock = async (blockNumber: number): Promise<BlockData> => {
  const { data } = await axios.get(
    `http://nanas.sh:9920/getblock/${blockNumber}`
  );
  return data;
};
