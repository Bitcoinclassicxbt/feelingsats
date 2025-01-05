import { Sequelize } from "sequelize";
import { log } from "../utils";
import { SettingModel } from "./models/Setting";
import { TransactionModel } from "./models/Transaction";
import { AddressModel } from "./models/Address";
import { UtxoModel } from "./models/Utxo";

export interface Models {
  Utxo: typeof UtxoModel;
  Setting: typeof SettingModel;
  Transaction: typeof TransactionModel;
  Address: typeof AddressModel;
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
  models.Transaction = TransactionModel.initialize(sequelize);
  models.Address = AddressModel.initialize(sequelize);
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
