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
  const queryCriteria = [];
  const queryParams = {};
  if (swaggerParams.cpvs) {
    queryCriteria.push("out('AppliedTo').in('Comprises').out('HasCPV').code in :cpvs");
    queryParams.cpvs = swaggerParams.cpvs;
  }
  if (swaggerParams.countries) {
    queryCriteria.push('xCountry in :countries');
    queryParams.countries = swaggerParams.countries;
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
    queryCriteria.push(_.join(actorQueries, ' OR '));
  }
  const query = `SELECT distinct(xYear)
    FROM Bid
    ${queryCriteria.length ? ` WHERE ${_.join(queryCriteria, ' AND ')}` : ''}`;
  return config.db.query(query, { params: queryParams })
    .then((results) => res.status(codes.SUCCESS).json({
      years: _.map(results, 'distinct'),
    }))
    .catch((err) => formatError(err, req, res));
}

module.exports = {
  getTenderYears,
};
