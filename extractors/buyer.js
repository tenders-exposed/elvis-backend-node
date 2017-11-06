'use strict';

const _ = require('lodash');
const moment = require('moment');


function extractBuyer(buyerAttrs) {
  return {
    id: buyerAttrs.id,
    name: buyerAttrs.name,
    address: buyerAttrs.address,
    isPublic: buyerAttrs.isPublic,
    buyerType: buyerAttrs.buyerType,
    isSubsidized: buyerAttrs.isSubsidized,
    xDigiwhistLastModified: moment(buyerAttrs.modified).format('YYYY-MM-DD HH:mm:ss'),
  };
}

function extractCreates(buyerAttrs, tenderAttrs) {
  let isLeader = buyerAttrs.isLeader;
  if (_.isUndefined(isLeader) && tenderAttrs.buyers.length === 1) {
    isLeader = true;
  }
  return {
    isLeader,
  };
}

module.exports = {
  extractBuyer,
  extractCreates,
};
