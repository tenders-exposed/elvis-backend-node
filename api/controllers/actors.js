'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const codes = require('../helpers/codes');
const config = require('../../config/default');
const formatError = require('../helpers/errorFormatter');
const actorSerializer = require('../serializers/actor');

function getTenderActors(req, res) {
  const swaggerParams = _.pickBy(
    _.mapValues(req.swagger.params, 'value'),
    (val) => !(_.isUndefined(val)),
  );
  return Promise.join(
    retrieveActors(swaggerParams, 'Buyer', 'Awards'),
    retrieveActors(swaggerParams, 'Bidder', 'Participates'),
    (buyers, bidders) => _
      .chain(buyers)
      .concat(bidders)
      .sortBy('$score')
      .value(),
  )
    .then((results) => {
      if (_.isUndefined(swaggerParams.limit) === false) {
        return _.take(results, swaggerParams.limit);
      }
      return results;
    })
    .then((results) => res.status(codes.SUCCESS).json({
      actors: _.map(results, (actor) => actorSerializer.formatActor(actor)),
    }))
    .catch((err) => formatError(err, req, res));
}

function retrieveActors(swaggerParams, actorClass, edgeToBidClass) {
  // Get only actors involved in bids
  const queryParams = {};
  const queryCriteria = [];
  let from = actorClass;
  const limit = swaggerParams.limit;
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
  const query = `SELECT *, $score FROM ${from}
    ${queryCriteria.length ? ` WHERE ${_.join(queryCriteria, ' AND ')}` : ''}
    ${limit ? ` LIMIT ${limit}` : ''};`;
  return config.db.query(query, { params: queryParams });
}

module.exports = {
  getTenderActors,
  retrieveActors,
};
