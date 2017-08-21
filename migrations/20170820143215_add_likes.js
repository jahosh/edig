exports.up = function (knex, Promise) {
  return knex.raw('SET foreign_key_checks = 0;')
    .then(() => {
      return knex.schema.table('sample', (table) => {
        table.integer('likes').defaultTo(0);
      });
    });
};

exports.down = function (knex, Promise) {
  return knex.schema.table('Sample', (table) => {
    table.dropColumn('likes');
  });
};