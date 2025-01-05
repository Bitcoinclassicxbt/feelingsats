import { Models } from "../database";
export const getCirculatingSupply = async (models: Models) => {
  try {
    const data = (await models.Utxo.findAll({
      attributes: [
        [
          models.sequelize.fn("SUM", models.sequelize.col("amount")),
          "totalSupply",
        ],
      ],
      raw: true,
    })) as any;

    return Number(data[0].totalSupply) / 1e8;
  } catch (e) {
    console.log(e);
  }
};
