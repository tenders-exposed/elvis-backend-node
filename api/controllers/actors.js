'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const codes = require('../helpers/codes');
const config = require('../../config/default');
const formatError = require('../helpers/errorFormatter');

function getTenderActors(req, res) {
  const swaggerParams = _.pickBy(
    _.mapValues(req.swagger.params, 'value'),
    (val) => !(_.isUndefined(val)),
  );
  return Promise.join(
    getActors(swaggerParams, 'Buyer', 'Awards'),
    getActors(swaggerParams, 'Bidder', 'Participates'),
    (buyers, bidders) => _
      .chain(buyers)
      .concat(bidders)
      .sortBy('$score')
      .value(),
  )
    .then((results) => res.status(codes.SUCCESS).json({
      actors: _.map(results, (buyer) => formatActor(buyer)),
    }))
    .catch((err) => formatError(err, req, res));
}

function getActors(swaggerParams, actorClass, edgeToBidClass) {
  // Get only buyers involved in bids
  const queryParams = {};
  const queryCriteria = [];
  let from = actorClass;
  if (swaggerParams.name) {
    queryParams.nameQuery = swaggerParams.name;
    // If the user didn't set fuzziness make this a prefix query
    if (_.isEmpty(swaggerParams.name.match(/~\d?$/))) {
      queryParams.nameQuery = `${swaggerParams.name}*`;
    }
    from = `(SELECT *, $score FROM ${actorClass} WHERE name LUCENE :nameQuery)`;
  }
  if (swaggerParams.years) {
    queryCriteria.push(`out('${edgeToBidClass}').xYear in :years`);
    queryParams.years = swaggerParams.years;
  }
  if (swaggerParams.countries) {
    queryCriteria.push(`out('${edgeToBidClass}').xCountry in :countries`);
    queryParams.countries = swaggerParams.countries;
  }
  if (swaggerParams.cpvs) {
    queryCriteria.push(`out('${edgeToBidClass}').out('AppliedTo').in('Comprises').out('HasCPV').code IN :cpvs`);
    queryParams.cpvs = swaggerParams.cpvs;
  }
  let query = `SELECT *, $score FROM ${from}`;
  if (_.isEmpty(queryCriteria) === false) {
    query = query.concat(` WHERE ${_.join(queryCriteria, 'AND')}`);
  }
  return config.db.query(query, { params: queryParams });
}

function formatActor(buyerNode) {
  const buyerResponse = _.pick(buyerNode, ['name', 'id']);
  buyerResponse.type = _.toLower(buyerNode['@class']);
  return buyerResponse;
}

module.exports = {
  getTenderActors,
  formatActor,
  getActors,
};
