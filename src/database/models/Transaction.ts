import { DataTypes, Model, Sequelize } from "sequelize";
import { Transaction } from "../../types";

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
  declare vin: any;
  declare vout: any;

  static initialize(sequelize: Sequelize): typeof TransactionModel {
    TransactionModel.init(
      {
        txid: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
          field: "txid", // Explicitly specify the field name
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
        timestamps: false, // Assuming you don't need createdAt/updatedAt
      }
    );
    return TransactionModel;
  }
}
