'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('EnergyReadings', [
      {
        timestamp: new Date('2026-04-08T08:00:00Z'),
        location: 'Eesti',
        price_eur_mwh: 45.50,
        source: 'NordPool',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        timestamp: new Date('2026-04-08T09:00:00Z'),
        location: 'Eesti',
        price_eur_mwh: 60.20,
        source: 'NordPool',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        timestamp: new Date('2026-04-08T10:00:00Z'),
        location: 'Eesti',
        price_eur_mwh: 55.00,
        source: 'NordPool',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('EnergyReadings', null, {});
  }
};