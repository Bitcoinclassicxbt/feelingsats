import { DataTypes, Model, Sequelize } from "sequelize";

interface AddressAttributes {
  address: string;
  lastSeen: number;
}

export class AddressModel
  extends Model<AddressAttributes>
  implements AddressAttributes
{
  declare address: string;
  declare lastSeen: number;

  static initialize(sequelize: Sequelize): typeof AddressModel {
    AddressModel.init(
      {
        address: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
          field: "address",
        },
        lastSeen: {
          type: DataTypes.INTEGER, // Use INTEGER for Unix timestamps
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: "addresses",
        timestamps: false,
      }
    );
    return AddressModel;
  }
}
