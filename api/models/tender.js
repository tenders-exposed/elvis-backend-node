'use strict';

const config = require('./../../config');
const helpers = require('./helpers');

// Suit a tender as it comes from Digiwhist data to our db
class Tender {
  constructor(attrs = {}) {
    this.dbClassName = 'Tender';
    Object.assign(this, {
      id: attrs.id,
      title: attrs.title,
      description: attrs.description,
      country: attrs.country,
      isFrameworkAgreement: attrs.isFrameworkAgreement,
      isCoveredByGpa: attrs.isCoveredByGpa,
      nationalProcedureType: attrs.nationalProcedureType,
      finalPrice: attrs.finalPrice,
      isWholeTenderCancelled: attrs.isWholeTenderCancelled,
      xIsEuFunded: (attrs.fundings || []).map((funding) => funding.isEuFund).includes(true),
      xDigiwhistLastModified: helpers.formatTimestamp(attrs.modified),
    });
  }
  async save() {
    config.db.create('vertex', this.dbClassName)
      .set(this.attrs);
  }
  async destroy() {
    config.db.delete('vertex', this.dbClassName)
      .where({ id: this.attrs.id });
  }
}

module.exports = Tender;
