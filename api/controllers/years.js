'use strict';

const _ = require('lodash');
const codes = require('../helpers/codes');
const config = require('../../config/default');
const formatError = require('../helpers/errorFormatter');

function getTenderYears(req, res) {
  const swaggerParams = _.pickBy(
    _.mapValues(req.swagger.params, 'value'),
    (val) => !(_.isUndefined(val)),
  );
  const queryCriteria = ['{ class: Bid, as: bids }'];
  const queryParams = {};
  if (swaggerParams.cpvs) {
    queryCriteria.push(`{ as: bids }.out('AppliedTo').in('Comprises').out('HasCPV')
      { class: CPV, where: (code in :cpvs)}`);
    queryParams.cpvs = swaggerParams.cpvs;
  }
  if (swaggerParams.countries) {
    queryCriteria.push('{ as: bids,  where: (xCountry in :countries) }');
    queryParams.countries = swaggerParams.countries;
  }
  if (swaggerParams.buyers) {
    queryCriteria.push(`{ as: bids }.in('Awards')
      { class: Buyer, where: (id in :buyers) }`);
    queryParams.buyers = swaggerParams.buyers;
  }
  if (swaggerParams.bidders) {
    queryCriteria.push(`{ as: bids }.in('Participates')
      { class: Bidder, where: (id in :bidders) }`);
    queryParams.bidders = swaggerParams.bidders;
  }
  const query = `SELECT distinct(years) FROM (
    MATCH ${_.join(queryCriteria, ',')}
    RETURN bids.xYear as years
  )`;
  return config.db.query(query, { params: queryParams })
    .then((results) => res.status(codes.SUCCESS).json({
      years: _.map(results, 'distinct'),
    }))
    .catch((err) => formatError(err, req, res));
}

module.exports = {
  getTenderYears,
};
