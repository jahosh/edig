const moment = require('moment');

exports.up = function(knex, Promise) {
  return knex.raw('SET foreign_key_checks = 0;')
    .then(() => {
      return knex.schema
        .createTable('sample', (table) => {
          table.increments('id').primary();
          table.string('title');
          table.string('thumbnail');
          table.string('src');
          table.string('created_at');
          table.string('sample_src');
          table.integer('total_samples');
        });
    });
};

exports.down = function(knex, Promise) {
  return knex.schema
    .dropTableIfExists('sample');
};
