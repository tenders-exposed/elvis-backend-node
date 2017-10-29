# elvis-backend-node

[![Coverage Status](https://coveralls.io/repos/github/tenders-exposed/elvis-backend-node/badge.svg?branch=master)](https://coveralls.io/github/tenders-exposed/elvis-backend-node?branch=master)

Search and visualize public procurements for EU countries http://elvis.tenders.exposed/

Previously, elvis.tenders.exposed was powered by tenders-exposed/elvis-backend but we decided to rewrite it completely because:

* the previous architecture based on MongoDB didn't allow us to efficiently implement clustering and splitting nodes
* the data provider changed and the data structure along with it

We chose Node.js because:

* we decided to use a graph database (OrientDB) and the Node.js ecosystem offered good tools for this
* Node.js is more widespread across the open spending and open contracting community
