'use strict';

const moment = require('moment');


function extractTender(tenderAttrs) {
  return {
    id: tenderAttrs.id,
    title: tenderAttrs.title,
    description: tenderAttrs.description,
    country: tenderAttrs.country,
    isFrameworkAgreement: tenderAttrs.isFrameworkAgreement,
    isCoveredByGpa: tenderAttrs.isCoveredByGpa,
    nationalProcedureType: tenderAttrs.nationalProcedureType,
    finalPrice: tenderAttrs.finalPrice,
    isWholeTenderCancelled: tenderAttrs.isWholeTenderCancelled,
    xIsEuFunded: tenderAttrs.fundings.map((funding) => funding.isEuFund).includes(true),
    xDigiwhistLastModified: moment(tenderAttrs.modified).format('YYYY-MM-DD HH:mm:ss'),
  };
}

module.exports = {
  extractTender,
};
