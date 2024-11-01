import axios from "axios";
import { BlockData } from "./types";

export const getBlock = async (blockNumber: number): Promise<BlockData> => {
  try {
    const { data } = await axios.get(
      `${process.env.RPC_BASE_URL}/getblock/${blockNumber}`
    );
    return data;
  } catch (e) {
    //console.dir(e.response.data);
    throw "Error fetching block " + (e?.response?.data?.toString() ?? "");
  }
};
