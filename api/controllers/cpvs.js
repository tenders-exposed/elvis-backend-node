'use strict';

const _ = require('lodash');
const codes = require('../helpers/codes');
const config = require('../../config/default');
const formatError = require('../helpers/errorFormatter');

function listCpvs(req, res) {
  const countries = req.swagger.params.countries.value;
  config.db.select().from('CPV').all()
    .then((cpvs) => res.status(codes.SUCCESS).json({
      cpvs: _.map(cpvs, (cpv) => _.pick(cpv, ['code', 'xName', 'xNumberDigits'])),
    }))
    .catch((err) => formatError(err));
}

module.exports = {
  listCpvs,
};
