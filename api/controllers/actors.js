'use strict';

const _ = require('lodash');
const codes = require('../helpers/codes');
const config = require('../../config/default');
const formatError = require('../helpers/errorFormatter');

function getTenderActors(req, res) {
  const swaggerParams = _.pickBy(
    _.mapValues(req.swagger.params, 'value'),
    (val) => !(_.isUndefined(val)),
  );
  // Get only buyers involved in bids
  const queryCriteria = [
    '{ class: Buyer, as: buyers }',
    "{ as: buyers }.out('Awards'){ class: Bid, as: bids}",
  ];
  const queryParams = {};
  if (swaggerParams.name) {
    queryCriteria.push('{ as: buyers, where: (name LUCENE :nameQuery) }');
    queryParams.nameQuery = swaggerParams.name;
    if (_.isEmpty(swaggerParams.name.match(/~\d?$/))) {
      queryParams.nameQuery = `${swaggerParams.name}*`;
    }
  }
  if (swaggerParams.countries) {
    queryCriteria.push('{ as: bids,  where: (xCountry in :countries) }');
    queryParams.countries = swaggerParams.countries;
  }
  if (swaggerParams.years) {
    queryCriteria.push('{ as: bids,  where: (xYear in :years) }');
    queryParams.years = swaggerParams.years;
  }
  if (swaggerParams.cpvs) {
    queryCriteria.push(`{ as: bids }.out('AppliedTo').in('Comprises').out('HasCPV')
      { class: CPV, where: (code in :cpvs)}`);
    queryParams.cpvs = swaggerParams.cpvs;
  }
  const query = `SELECT expand(buyers) FROM (
    MATCH ${_.join(queryCriteria, ',')}
    RETURN buyers
  )`;
  return config.db.query(query, { params: queryParams })
    .then((results) => res.status(codes.SUCCESS).json({
      actors: _.map(results, (buyer) => formatBuyer(buyer)),
    }))
    .catch((err) => formatError(err, req, res));
}

function formatBuyer(buyerNode) {
  const buyerResponse = _.pick(buyerNode, ['name', 'id']);
  buyerResponse.type = _.toLower(buyerNode['@class']);
  return buyerResponse;
}

module.exports = {
  getTenderActors,
  formatBuyer,
};
