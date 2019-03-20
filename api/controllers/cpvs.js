'use strict';

const _ = require('lodash');
const codes = require('../helpers/codes');
const config = require('../../config/default');
const formatError = require('../helpers/errorFormatter');
const cpvSerializer = require('../serializers/cpv');

function getTenderCpvs(req, res) {
  const swaggerParams = _.pickBy(
    _.mapValues(req.swagger.params, 'value'),
    (val) => !(_.isUndefined(val)),
  );
  const queryCriteria = [];
  const queryParams = {};
  if (swaggerParams.countries) {
    queryCriteria.push('xCountry in :countries');
    queryParams.countries = swaggerParams.countries;
  }
  if (swaggerParams.years) {
    queryCriteria.push('xYear in :years');
    queryParams.years = swaggerParams.years;
  }
  const actorQueries = [];
  if (swaggerParams.buyers) {
    actorQueries.push("in('Awards').id in :buyers");
    queryParams.buyers = swaggerParams.buyers;
  }
  if (swaggerParams.bidders) {
    actorQueries.push("in('Participates').id in :bidders");
    queryParams.bidders = swaggerParams.bidders;
  }
  if (actorQueries.length) {
    queryCriteria.push(`(${_.join(actorQueries, ' OR ')})`);
  }
  const cpvsQuery = `SELECT code, xNumberDigits, xName, military,
    bidIDs.size() as xNumberBids
    FROM (
      SELECT cpv.code as code,
      cpv.xNumberDigits as xNumberDigits,
      cpv.xName as xName,
      cpv.military as military,
      set(bidID) as bidIDs
      FROM (
        SELECT id as bidID, out('BidHasCPV') as cpv
          FROM Bid
          ${queryCriteria.length ? ` WHERE ${_.join(queryCriteria, ' AND ')}` : ''}
        UNWIND cpv
      ) WHERE cpv.code IS NOT NULL
      GROUP BY cpv
      ORDER BY code asc
    );`;
  return config.db.query(cpvsQuery, { params: queryParams })
    .then((results) => res.status(codes.SUCCESS).json({
      cpvs: _.map(results, (cpv) => cpvSerializer.formatCpv(cpv)),
    }))
    .catch((err) => formatError(err, req, res));
}

module.exports = {
  getTenderCpvs,
};
