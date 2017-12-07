'use strict';

const config = require('../config');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const GitHubStrategy = require('passport-github').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const LocalStrategy = require('passport-local').Strategy;

module.exports.configureStrategies = () => {
  passport.use(new LocalStrategy(((email, password, done) => {
    config.db.select().from('Users')
      .where({
        email,
      })
      .one()
      .then((user) => {
        if (!user) {
          return done(null, false, { message: 'Incorrect username.' });
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
    },
    (accessToken, refreshToken, profile, cb) => {
      console.log('Github profile: ', profile);
      config.db.query(
        'SELECT @rid, email, githubId, twitterId FROM Users WHERE githubId = :githubId OR email = :email',
        {
          params: {
            githubId: profile.id,
            email: profile.email,
          },
        },
      )
        .then((user) => {
          if (user) {
            return user;
          }

          return config.db.create('VERTEX', 'Users')
            .set({
              twitterId: profile.id,
              email: profile.email,
            }).one();
        })
        .then((user) => {
          console.log(user);
          cb(null, user);
        })
        .catch((err) => cb(err));
    },
  ));

  passport.use(new TwitterStrategy(
    {
      consumerKey: config.passport.twitter.apiKey,
      consumerSecret: config.passport.twitter.apiSecret,
      callbackURL: config.passport.twitter.callbackUrl,
    },
    (token, tokenSecret, profile, cb) => {
      console.log('Twitter profile: ', profile);
      config.db.query(
        'SELECT @rid, email, githubId, twitterId FROM Users WHERE twitterId = :twitterId OR email = :email',
        {
          params: {
            twitterId: profile.id,
            email: profile.email,
          },
        },
      )
        .then((user) => {
          if (user) {
            return user;
          }

          return config.db.create('VERTEX', 'Users')
            .set({
              twitterId: profile.id,
              email: profile.email,
            }).one();
        })
        .then((user) => {
          console.log(user);
          cb(null, user);
        })
        .catch((err) => cb(err));
    },
  ));

  passport.serializeUser((user, done) => {
    done(null, user['@rid']);
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
