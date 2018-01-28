'use strict';

exports.name = 'rename description to synopsis';

exports.up = (db) => db.class.get('Network')
  .then((Network) => Network.property.rename('description', 'synopsis'));

exports.down = (db) => db.class.get('Network')
  .then((Network) => Network.property.rename('synopsis', 'description'));

