'use strict';

const _ = require('lodash');
const fs = require('fs');
const readline = require('readline');
const config = require('./../config');
const tenderExtractor = require('./../extractors/tender');
const buyerExtractor = require('./../extractors/buyer');

// Alternative implementation where the update/create logic happens in the `then` of `one()`
// Same problem as below, `existingRecord` is always undefined thus `update` never happens and the `created` done instead fails
function upsertVertex(transaction, className, attrs) {
  const recordName = `${className.toLowerCase()}${attrs.id.replace(/-/g, '')}`;
  config.db.select().from(className).where({ id: attrs.id }).one()
    .then((existingRecord) => {
      transaction.let(recordName, (t) => {
        if (_.isUndefined(existingRecord)) {
          transaction.create('vertex', className)
            .set(attrs);
        } else {
          t.update(className)
            .set(attrs)
            .where({ id: attrs.id })
            .return('AFTER');
        }
      });
    });
}

function writeTender(tenderAttrs) {
  const tender = tenderExtractor.extractTender(tenderAttrs);
  function recordName(uuid, className) {
    return `${className.toLowerCase()}${uuid.replace(/-/g, '')}`;
  }
  const tenderName = recordName(tender.id, 'Tender');

  // `existingTender` is always undefined thus `update` never happens and the `create` done instead fails
  let existingTender;
  config.db.select().from('Tender').where({ id: tender.id }).one()
    .then((t) => { existingTender = t; });

  let trx = config.db.let(tenderName, (t) => {
    if (_.isUndefined(existingTender)) {
      t.create('vertex', 'Tender')
        .set(tender);
    } else {
      t.update('Tender')
        .set(tender)
        .where({ id: tender.id })
        .return('AFTER');
    }
  });

  tenderAttrs.buyers.forEach((buyerAttrs) => {
    const buyer = buyerExtractor.extractBuyer(buyerAttrs);
    const buyerName = recordName(buyer.id, 'Buyer');
    const createsName = `${buyerName}creates${tenderName}`;
    const fromName = `$${buyerName}`;
    const toName = `$${tenderName}`;
    let existingBuyer;

    config.db.select().from('Buyer').where({ id: buyer.id }).one()
      .then((b) => { existingBuyer = b; });
    trx.let(buyerName, (t) => {
      if (_.isUndefined(existingBuyer)) {
        t.create('vertex', 'Buyer')
          .set(buyer);
      } else {
        t.update('Buyer')
          .set(buyer)
          .where({ id: buyer.id })
          .return('AFTER');
        // trx.let(createsName, (t) => {
        //   t.delete('edge', 'Creates')
        //     .from(fromName)
        //     .to(toName);
        // });
      }
    });
    trx.let(createsName, (t) => {
      t.create('edge', 'Creates')
        .from(fromName)
        .to(toName)
        .set(buyerExtractor.extractCreates(buyerAttrs, tenderAttrs));
    });
  });

  const returnName = `$${tenderName}`;
  trx.commit().return(returnName).all()
    .then((results) => { console.log(results); })
    .catch((err) => {
      console.log(err);
      console.log(tenderAttrs);
    });
}

function importFileData(filePath) {
  const instream = fs.createReadStream(filePath);
  const iterator = readline.createInterface({ input: instream });

  iterator.on('line', (line) => {
    const tenderAttrs = JSON.parse(line);
    const awardedLots = _.compact((tenderAttrs.lots || []).map((lot) => {
      if ((lot.bids || []).filter((bid) => bid.isWinning === true).length >= 1) {
        return lot;
      }
    }));
    if (_.isEmpty(awardedLots)) {
      return;
    }
    writeTender(tenderAttrs);
  });

  iterator.on('close', () => {
  });
}

function importDumpFiles() {
  const dumpFilePaths = process.argv.slice(2);

  dumpFilePaths.forEach((filePath) => importFileData(filePath));
}

importDumpFiles()
