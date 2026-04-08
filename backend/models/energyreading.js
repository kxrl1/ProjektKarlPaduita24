'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class EnergyReading extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  EnergyReading.init({
    timestamp: DataTypes.DATE,
    location: DataTypes.STRING,
    price_eur_mwh: DataTypes.FLOAT,
    source: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'EnergyReading',
  });
  return EnergyReading;
};