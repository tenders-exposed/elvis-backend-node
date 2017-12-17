'use strict';

const _ = require('lodash');
const config = require('../../config/default');

// Suit a tender as it comes from Digiwhist data to our db
class Tender {
  constructor(attrs = {}) {
    this.dbClassName = 'Tender';
    this.properties = [
      'id',
      'title',
      'description',
      'country',
      'isFrameworkAgreement',
      'isCoveredByGpa',
      'nationalProcedureType',
      'finalPrice',
      'isWholeTenderCancelled',
      'xIsEuFunded',
      'xDigiwhistLastModified',
    ];
    Object.assign(this, _.pick(attrs, this.properties));
  }
  async save() {
    return config.db.create('vertex', this.dbClassName)
      .set(this.toJSON()).commit().one();
  }
  async destroy() {
    return config.db.delete('vertex', this.dbClassName)
      .where({ id: this.id }).commit().one();
  }
  toJSON() {
    return _.pick(this, this.properties);
  }
}

module.exports = Tender;
