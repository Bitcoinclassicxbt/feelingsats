import { DataTypes, Model, Optional, Sequelize } from "sequelize";
import { UTXO } from "../../types";

type UTXOAttributes = UTXO & { id: number };

export type UTXOCreationAttributes = Optional<UTXOAttributes, "id">;

export class UtxoModel
  extends Model<UTXOAttributes, UTXOCreationAttributes>
  implements UTXOAttributes
{
  declare id: number;
  declare txid: string;
  declare vout: number;
  declare address: string;
  declare amount: string;
  declare hex: string;
  declare block: number;
  declare block_hash: string;
  declare block_timestamp: bigint;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static initialize(sequelize: Sequelize): typeof UtxoModel {
    UtxoModel.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        txid: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        vout: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        address: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        amount: {
          type: DataTypes.BIGINT,
          allowNull: false,
        },
        hex: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        block: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        block_hash: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        block_timestamp: {
          type: DataTypes.BIGINT,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: "utxos",
        indexes: [
          {
            fields: ["txid"],
            using: "BTREE",
          },
          {
            fields: ["address"],
            using: "BTREE",
          },
          {
            fields: ["block"],
            using: "BTREE",
          },

          {
            unique: true,
            fields: ["txid", "vout"],
          },
        ],
        timestamps: true,
      }
    );
    return UtxoModel;
  }
}
