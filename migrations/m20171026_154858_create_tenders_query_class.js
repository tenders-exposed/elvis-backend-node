"use strict";
exports.name = "create tenders query class";

exports.up = (db) => (
  db.class.create('TendersQuery')
  .then((TendersQuery) => {
    TendersQuery.property.create([
      {
        name: 'countries',
        type: 'EmbeddedSet',
      },
      {
        name: 'cpvs',
        type: 'EmbeddedSet',
      },
      {
        name: 'years',
        type: 'EmbeddedSet',
      },
      {
        name: 'suppliers',
        type: 'EmbeddedSet',
      },
      {
        name: 'buyers',
        type: 'EmbeddedSet',
      },
   ]);
  })
);

exports.down = (db) => (
  db.class.drop('TendersQuery')
);
