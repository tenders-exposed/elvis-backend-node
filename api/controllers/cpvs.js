'use strict';

const _ = require('lodash');
const codes = require('../helpers/codes');
const config = require('../../config/default');
const formatError = require('../helpers/errorFormatter');

function listCpvs(req, res) {
  const swaggerParams = _.pickBy(
    _.mapValues(req.swagger.params, 'value'),
    (val) => !(_.isUndefined(val)),
  );
  let cpvs;
  if (_.isEmpty(swaggerParams)) {
    cpvs = config.db.select().from('CPV').all();
  } else {
    const queryCriteria = [];
    const queryParams = {};
    if (swaggerParams.countries) {
      queryCriteria.push('{ as: bids,  where: (xCountry in :countries) }');
      queryParams.countries = swaggerParams.countries;
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
    const query = `SELECT expand(cpvs) FROM (
      MATCH { class: Bid, as: bids },
        ${_.join(queryCriteria, ',')},
        { as: bids }.out('AppliedTo').in('Comprises').out('HasCPV'){ as: cpvs }
      RETURN cpvs
    )`;
    cpvs = config.db.query(query, { params: queryParams });
  }
  return cpvs
    .then((results) => res.status(codes.SUCCESS).json({
      cpvs: _.map(results, (cpv) => formatCpv(cpv)),
    }))
    .catch((err) => formatError(err, req, res));
}

function formatCpv(cpvNode) {
  return _.pick(cpvNode, ['code', 'xName', 'xNumberDigits']);
}

module.exports = {
  listCpvs,
  formatCpv,
};
