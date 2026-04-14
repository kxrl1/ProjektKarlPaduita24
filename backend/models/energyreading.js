'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EnergyReading extends Model {
    static associate(models) {}
  }

  EnergyReading.init({
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    price_eur_mwh: {
      type: DataTypes.FLOAT,
      allowNull: true, // võib olla null vastavalt nõuetele
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'UPLOAD',
    }
  }, {
    sequelize,
    modelName: 'EnergyReading',
    // Unikaalne piirang duplikaatide vältimiseks (timestamp + location)
    indexes: [
      {
        unique: true,
        fields: ['timestamp', 'location'],
        name: 'unique_timestamp_location'
      }
    ]
  });

  return EnergyReading;
};