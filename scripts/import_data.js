'use strict';

const _ = require('lodash');
const fs = require('fs');
const readline = require('readline');
const config = require('./../config');
const tenderExtractor = require('./../extractors/tender');
const buyerExtractor = require('./../extractors/buyer');

function recordName(uuid, className) {
  return `${className.toLowerCase()}${uuid.replace(/-/g, '')}`;
}

function upsertBuyer(transaction, rawBuyer, rawTender) {
  const buyer = buyerExtractor.extractBuyer(rawBuyer);
  const buyerName = recordName(buyer.id, 'Buyer');
  const tenderName = recordName(rawTender.id, 'Tender');
  const createsName = `${buyerName}creates${tenderName}`;
  const fromName = `$${buyerName}`;
  const toName = `$${tenderName}`;

  return config.db.select().from('Buyer').where({ id: buyer.id }).one()
    .then((existingBuyer) => {
      transaction.let(buyerName, (t) => {
        if (_.isUndefined(existingBuyer)) {
          t.create('vertex', 'Buyer')
            .set(buyer);
        } else {
          t.update('Buyer')
            .set({ buyerType: 'Alabalaportocala' })
            .where({ id: buyer.id })
            .return('AFTER');
          // trx.let(createsName, (t) => {
          //   t.delete('edge', 'Creates')
          //     .from(fromName)
          //     .to(toName);
          // });
        }
      }).let(createsName, (t) => {
        t.create('edge', 'Creates')
          .from(fromName)
          .to(toName)
          .set(buyerExtractor.extractCreates(rawBuyer, rawTender));
      });
      return transaction;
    });
}

function writeTender(rawTender) {
  config.db.on("endQuery", function(obj) {
    console.log("DEBUG QUERY:");
    console.dir(obj.input);
  });
  const tender = tenderExtractor.extractTender(rawTender);
  const tenderName = recordName(tender.id, 'Tender');

  config.db.select().from('Tender').where({ id: tender.id }).one()
    .then((existingTender) => {
      let transaction = config.db.let(tenderName, (t) => {
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
      return transaction;
    })
    .then((transaction) => {
      Promise.all([
        // createBuyers
        Promise.each(rawTender.buyers, (rawBuyer) => {
          upsertBuyer(transaction, rawBuyer, rawTender);
        }),
        // createLots,
        // createCPVs,
      ])
        // .then(() => {
        //   createAwarded edge between bids and buyers
        // })
        .then(() => {
          const returnName = `$${tenderName}`;          
          transaction.commit().return(returnName).all()
            .then((results) => { console.log(results); })
            .catch((err) => {
              console.log(transaction._state.let);
              console.log(err);
              process.exit(-1);
            });
        });
    });
}

function importFileData(filePath) {
  const instream = fs.createReadStream(filePath);
  const handler = readline.createInterface({ input: instream });

  handler.on('line', (line) => {
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

  handler.on('close', () => {
  });
}

function importDumpFiles() {
  const dumpFilePaths = process.argv.slice(2);

  dumpFilePaths.forEach((filePath) => importFileData(filePath));
}

importDumpFiles();
