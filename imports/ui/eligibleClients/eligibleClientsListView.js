import { logger } from '/imports/utils/logger';
import EligibleClients from '/imports/api/eligibleClients/eligibleClients';
import './eligibleClientsListView.html';


const tableOptions = {
  columns: [
    {
      data: 'clientId',
      title: 'Client',
      render(value, type, doc) {
        const client = doc.clientDetails;
        const { firstName, middleName, lastName } = client;

        let displayName = `${firstName || ''} ${middleName || ''} ${lastName || ''}`;
        displayName = displayName.trim();

        if (!displayName) {
          displayName = doc.clientId;
        }

        if (client.schema) {
          const url = Router.path(
            'viewClient',
            { _id: client.clientId },
            { query: `isHMISClient=true&schema=${client.schema}` }
          );
          return `<a href="${url}">${displayName}</a>`;
        }
        return displayName;
      },
    },
    {
      title: 'Score',
      data: 'surveyScore',
      render(value, type, doc) {
        const client = doc.clientDetails;
        if (client.schema) {
          const url = Router.path(
            'adminDashboardresponsesView',
            { _id: client.clientId },
            { query: `clientID=${client.clientId}` }
          );
          return `<a href="${url}">${value}</a>`;
        }
        return value;
      },
    },
    {
      title: 'Survey Date',
      data: 'surveyDate',
    },
    {
      title: 'Match Status',
      data: 'matched',
    },
  ],
  dom: HomeConfig.adminTablesDom,
};


Template.eligibleClientsListView.helpers({
  hasData() {
    return EligibleClients.find().count() > 0;
  },
  tableData() {
    console.log('aaa');
    return () => EligibleClients.find({}).fetch();
  },
  tableOptions() {
    return tableOptions;
  },
});

Template.eligibleClientsListView.events(
  {
    'click .postHousingMatchScores': () => {
      Meteor.call(
        'postHousingMatchScores', (error, result) => {
          if (error) {
            logger.error(`postHousingMatchScores - ${error}`);
          } else {
            logger.info(`postHousingMatchScores - ${result}`);
          }
        }
      );
    },
  }
);