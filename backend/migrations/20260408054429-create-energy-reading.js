'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('EnergyReadings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false
      },
      location: {
        type: Sequelize.STRING,
        allowNull: false
      },
      price_eur_mwh: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      source: {
        type: Sequelize.STRING,
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Unikaalne piirang: sama timestamp + location ei tohi korduda
    // See tagab, et upsert töötab õigesti
    await queryInterface.addIndex('EnergyReadings', ['timestamp', 'location'], {
      unique: true,
      name: 'unique_timestamp_location'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('EnergyReadings', 'unique_timestamp_location');
    await queryInterface.dropTable('EnergyReadings');
  }
};