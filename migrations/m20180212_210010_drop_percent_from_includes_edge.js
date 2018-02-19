'use strict';

exports.name = 'drop percent from includes edge';

exports.up = (db) => (
  db.class.get('Includes')
    .then((Includes) => Includes.property.drop('percent'))
);

exports.down = (db) => (
  db.class.get('Includes')
    .then((Includes) =>
      Includes.property.create([
        {
          name: 'percent',
          type: 'Double',
        }]))
);
