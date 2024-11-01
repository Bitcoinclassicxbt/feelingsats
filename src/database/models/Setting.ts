import { Sequelize, DataTypes, Model } from "sequelize";
import { Setting } from "../../types";

type SettingAttributes = Setting;

export class SettingModel
  extends Model<SettingAttributes>
  implements SettingAttributes
{
  declare key: string;
  declare value: string;

  static initialize(sequelize: Sequelize): typeof SettingModel {
    SettingModel.init(
      {
        key: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
          field: "key", // Explicitly specify the field name
        },
        value: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: "settings",
        timestamps: false, // Assuming you don't need createdAt/updatedAt
      }
    );
    return SettingModel;
  }
}
