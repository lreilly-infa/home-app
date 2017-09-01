import { eachLimit } from 'async';
import { HmisClient } from '/imports/api/hmis-api';
import { logger } from '/imports/utils/logger';

Meteor.publish('eligibleClients.list', function publishEligibleClients() {
  const self = this;
  let stopFunction = false;
  self.unblock();

  self.onStop(() => {
    stopFunction = true;
  });

  if (!this.userId) {
    return [];
  }

  try {
    const hc = HmisClient.create(this.userId);
    let eligibleClients = hc.api('house-matching').getEligibleClients();

    // filter by ignoreMatchProcess field
    eligibleClients = _.filter(eligibleClients, (c) => c.ignoreMatchProcess === false);

    // populate the list without the details
    for (let i = 0; i < eligibleClients.length && !stopFunction; i += 1) {
      eligibleClients[i].clientDetails = { loading: true };
      self.added('localEligibleClients', eligibleClients[i].clientId, eligibleClients[i]);
    }
    self.ready();

    // Add client details (Name & link to profile) here.
    const queue = [];
    for (let i = 0; i < eligibleClients.length && !stopFunction; i += 1) {
      let schema = 'v2015';
      if (eligibleClients[i].links && eligibleClients[i].links.length > 0) {
        if (eligibleClients[i].links[0].href.indexOf('v2014') !== -1) {
          schema = 'v2014';
        }
      }
      queue.push({
        clientId: eligibleClients[i].clientId,
        schema,
      });
    }

    eachLimit(queue, Meteor.settings.connectionLimit, (data, callback) => {
      Meteor.defer(() => {
        const { clientId, schema } = data;
        let clientDetails;
        try {
          clientDetails = hc.api('client').getClient(clientId, schema);
          clientDetails.schema = schema;
        } catch (e) {
          clientDetails = { error: e.reason };
        }
        self.changed('localEligibleClients', clientId, { clientDetails });
        callback();
      });
    });
  } catch (err) {
    logger.error('publish eligibleClients', err);
  }
  return self.ready();
});
