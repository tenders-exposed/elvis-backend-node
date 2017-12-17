'use strict';

const config = require('../../config/default');

function listCpvs(req, res) {
  const countries = req.swagger.params.countries.value;
  console.log('Countries param:', countries); // eslint-disable-line no-console
  config.db.select('code').from('CPV').all()
    .then((cpvs) => res.json(cpvs));
}

module.exports = {
  listCpvs,
};
