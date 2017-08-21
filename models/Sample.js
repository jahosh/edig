const Model = require('objection').Model;
const moment = require('moment');

class Sample extends Model {
  $beforeInsert() {
    this.created_at = moment().format('LL');
  }
  static get tableName() {
    return 'sample';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: [],
      properties: {
        id: { type: 'integer' },
        title: { type: 'string' },
        thumbnail: { type: 'string'},
        sample_src: { type: 'string' },
        src: { type: 'string' },
        total_samples: { type: 'integer' },
        likes: { type: 'integer' }
      }
    };
  }
}

module.exports = Sample;