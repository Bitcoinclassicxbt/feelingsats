import { Models } from "../database";

let circulatingSupply = 0;

export const getCirculatingSupply = () => {
  return circulatingSupply;
};

export const updateCirculatingSupply = async (models: Models) => {
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

    circulatingSupply = Number(data[0].totalSupply) / 1e8;
  } catch (e) {
    console.log(e);
  }
};
