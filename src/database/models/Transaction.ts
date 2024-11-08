import { DataTypes, Model, Sequelize } from "sequelize";
import { Transaction, Vin, Vout } from "../../types";

type TransactionAttributes = Transaction;

export class TransactionModel
  extends Model<TransactionAttributes>
  implements TransactionAttributes
{
  declare txid: string;
  declare hash: string;
  declare size: number;
  declare locktime: number;
  declare version: number;
  declare vsize: number;
  declare vin: Vin[];
  declare vout: Vout[];

  static initialize(sequelize: Sequelize): typeof TransactionModel {
    TransactionModel.init(
      {
        txid: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
          field: "txid",
        },
        hash: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        size: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        locktime: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        version: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        vsize: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        vin: {
          type: DataTypes.JSONB,
          allowNull: false,
        },
        vout: {
          type: DataTypes.JSONB,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: "transactions",
        timestamps: false,
        indexes: [
          {
            fields: [sequelize.literal(`(vin->>'address')`)],
            using: "BTREE",
          },
          {
            fields: [sequelize.literal(`(vout->>'address')`)],
            using: "BTREE",
          },
        ],
      }
    );
    return TransactionModel;
  }
}
