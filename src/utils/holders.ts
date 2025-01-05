import { Models } from "../database";

export type IHolder = {
  address: string;
  balance: number;
  position?: number;
  lastSeen?: number;
};

export const getHolders = async (models: Models) => {
  try {
    const UtxoResponse = await models.Utxo.findAll({
      attributes: [
        "address",
        [models.sequelize.fn("SUM", models.sequelize.col("amount")), "balance"],
      ],
      group: ["address"],
      order: [[models.sequelize.literal("balance"), "DESC"]],
      raw: true,
    });

    const holders: IHolder[] = UtxoResponse.map((utxo: any, index: number) => ({
      address: utxo.address,
      balance: Number(utxo.balance),
      position: index + 1,
    }));

    const lastSeenResponse = await models.Address.findAll({
      attributes: ["address", "lastSeen"],
      raw: true,
    });

    const lastSeenMap: Record<string, number> = lastSeenResponse.reduce(
      (acc: Record<string, number>, address: any) => {
        acc[address.address] = address.lastSeen;
        return acc;
      },
      {}
    );

    holders.forEach((holder) => {
      holder.lastSeen = lastSeenMap[holder.address];
    });
  } catch (e) {
    console.log(e);
  }
};
