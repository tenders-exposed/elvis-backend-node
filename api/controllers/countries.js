'use strict';

const _ = require('lodash');
const codes = require('../helpers/codes');
const config = require('../../config/default');
const formatError = require('../helpers/errorFormatter');

function getTenderCountries(req, res) {
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
  if (swaggerParams.years) {
    queryCriteria.push('{ as: bids,  where: (xYear in :years) }');
    queryParams.years = swaggerParams.years;
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
  const query = `SELECT distinct(country) FROM (
    MATCH ${_.join(queryCriteria, ',')}
    RETURN bids.xCountry as country
  )`;
  return config.db.query(query, { params: queryParams })
    .then((results) => config.db.query(
      'SELECT * from Country where code in :countryCodes',
      { params: { countryCodes: _.map(results, 'distinct') } },
    ))
    .then((results) => res.status(codes.SUCCESS).json({
      countries: _.map(results, (country) => formatCountry(country)),
    }))
    .catch((err) => formatError(err, req, res));
}

function formatCountry(country) {
  return _.pick(country, ['code', 'name']);
}

module.exports = {
  getTenderCountries,
  formatCountry,
};
