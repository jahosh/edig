
exports.up = function(knex, Promise) {
  return knex.schema.table('sample', (table) => {
    table.string('category').defaultTo('general');
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.table('sample', (table) => {
    table.dropColumn('category');
  });
};
