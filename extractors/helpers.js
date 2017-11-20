'use strict';

const _ = require('lodash')
const moment = require('moment');

// Format timestamp string so that OrientJS accepts it
function formatTimestamp(timestampStr) {
  let formattedDate;
  if (_.isNil(timestampStr) === false) {
    formattedDate = moment(timestampStr).format('YYYY-MM-DD HH:mm:ss');
  }
  return formattedDate;
}

module.exports = {
  formatTimestamp,
};
