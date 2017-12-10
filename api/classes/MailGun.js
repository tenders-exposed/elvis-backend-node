'use strict';

const _ = require('lodash');
const config = require('../../config/default');
const mailgun = require('mailgun-js')({
  apiKey: config.mailgun.apiKey,
  domain: config.mailgun.domain,
});

class MailGun {
  constructor() {
    this.apiKey = config.mailgun.apiKey;
    this.domain = config.mailgun.domain;
    this.from = config.mailgun.from;
  }

  sendEmail(options = {}) {
    return new Promise(((resolve, reject) => {
      const {
        text, html, filePath, subject, to, recipientVars,
      } = options;
      const data = {
        from: this.from,
        to,
      };

      if (subject) {
        data.subject = subject;
      }
      if (text) {
        data.text = text;
      }
      if (html) {
        data.html = html;
      }
      if (filePath) {
        data.attachment = filePath;
      }
      if (recipientVars && _.keys(recipientVars).length) {
        data['recipient-variables'] = recipientVars;
      }

      mailgun.messages().send(data)
        .then((body) => {
          // console.log('Email sent');
          resolve(body);
        })
        .catch((err) => {
          // console.log('Error in email sending: ', err);
          reject(err);
        });
    }));
  }
}

module.exports = new MailGun();
