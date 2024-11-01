import { Sequelize } from "sequelize";
import { log } from "../utils";
import { UtxoModel } from "./models/Utxo";
import { SettingModel } from "./models/Setting";

export interface Models {
  Utxo: typeof UtxoModel;
  Setting: typeof SettingModel;
  sequelize: Sequelize;
}

export async function databaseConnection(forceSync: boolean): Promise<Models> {
  const models = {} as Models;

  const sequelize = new Sequelize(
    `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    {
      logging: false,
      dialect: "postgres",
      dialectOptions: {
        connectTimeout: 60000,
        supportBigNumbers: true,
        bigNumberStrings: false,
      },
    }
  );

  models.Utxo = UtxoModel.initialize(sequelize);
  models.Setting = SettingModel.initialize(sequelize);
  models.sequelize = sequelize;

  log("Connecting to database...", "Database");

  try {
    await sequelize.authenticate();
    await sequelize.sync({ force: forceSync });
    return models;
  } catch (e) {
    log((e as Error).toString(), "DatabaseError");
    log("Retrying database connection...", "Database");
    throw e;
  }
}
