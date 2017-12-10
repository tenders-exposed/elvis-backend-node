'use strict';

const config = require('../config/default');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const GitHubStrategy = require('passport-github').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const LocalStrategy = require('passport-local').Strategy;

module.exports.configureStrategies = () => {
  passport.use(new LocalStrategy({ usernameField: 'email' }, ((email, password, done) => {
    config.db.select().from('Users')
      .where({
        email,
      })
      .one()
      .then((user) => {
        if (!user) {
          return done(null, false, { message: 'Incorrect email.' });
        }

        if (!bcrypt.compareSync(password, user.password)) {
          return done(null, false, { message: 'Incorrect password.' });
        }

        return done(null, user);
      })
      .catch((err) => done(err));
  })));

  passport.use(new GitHubStrategy(
    {
      clientID: config.passport.github.clientId,
      clientSecret: config.passport.github.clientSecret,
      callbackURL: config.passport.github.callbackUrl,
      scope: ['user:email'],
    },
    (accessToken, refreshToken, profile, cb) => {
      // console.log('Github profile: ', profile);
      let email;
      let foundUser;
      let query = 'SELECT @rid, email, githubId, twitterId FROM Users WHERE githubId = :githubId';
      const params = {
        githubId: profile.id,
        regProvider: 'github',
      };
      if (profile.emails && profile.emails.length) {
        profile.emails.forEach((item) => {
          if (item.primary) {
            email = item.value;
          }
        });
      }
      if (email) {
        params.email = email;
        query += ' OR email = :email';
      }
      config.db.query(
        query,
        {
          params,
        },
      )
        .then((user) => {
          if (user && user.length) {
            foundUser = user[0];
            return user[0];
          }
          return config.db.class.get('Users');
        })
        .then((Users) => {
          if (foundUser) {
            if (!foundUser.githubId) {
              foundUser.githubId = profile.id;
              return config.db.update(foundUser.rid).set({ githubId: profile.id }).one();
            }
            return foundUser;
          }

          return Users.create(params);
        })
        .then((user) => {
          // console.log(user);
          foundUser = foundUser || user;
          cb(null, foundUser);
        })
        .catch((err) => cb(err));
    },
  ));

  passport.use(new TwitterStrategy(
    {
      consumerKey: config.passport.twitter.apiKey,
      consumerSecret: config.passport.twitter.apiSecret,
      callbackURL: config.passport.twitter.callbackUrl,
      includeEmail: true,
    },
    (token, tokenSecret, profile, cb) => {
      // console.log('Twitter profile: ', profile);
      let email;
      let foundUser;
      let query = 'SELECT @rid, email, githubId, twitterId FROM Users WHERE twitterId = :twitterId';
      const params = {
        twitterId: profile.id,
        regProvider: 'twitter',
      };
      if (profile.emails && profile.emails.length) {
        email = profile.emails[0].value;
      }
      if (email) {
        params.email = email;
        query += ' OR email = :email';
      }
      config.db.query(
        query,
        {
          params,
        },
      )
        .then((user) => {
          if (user && user.length) {
            foundUser = user[0];
            return user[0];
          }
          return config.db.class.get('Users');
        })
        .then((Users) => {
          if (foundUser) {
            if (!foundUser.twitterId) {
              foundUser.twitterId = profile.id;
              return config.db.update(foundUser.rid).set({ twitterId: profile.id }).one();
            }
            return foundUser;
          }

          return Users.create(params);
        })
        .then((user) => {
          // console.log(user);
          foundUser = foundUser || user;
          cb(null, foundUser);
        })
        .catch((err) => cb(err));
    },
  ));

  passport.serializeUser((user, done) => {
    done(null, user.rid || user['@rid']);
  });

  passport.deserializeUser((id, done) => {
    config.db.select().from('Users')
      .where({
        '@rid': id,
      })
      .one()
      .then((user) => done(null, user))
      .catch((err) => done(err));
  });
};
