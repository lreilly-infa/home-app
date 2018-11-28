import './app';
import './content';
import './clients';
import './eligibleClients';
import './files';
import './housingMatch';
import './questions';
import './surveys';
import './responses';
import './housingUnits';
import './globalHouseholds';
import './users';
import './roleManager';
import './openingScript';
import './projects';
import './agencies';
import './plugins';

Meteor.startup(() => {
  console.log('aaa');
  Meteor.subscribe('test.injection', 123, 456);
});
