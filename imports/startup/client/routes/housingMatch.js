import { AppController } from './controllers';
import { DefaultAdminAccessRoles } from '/imports/config/permissions';


Router.route('adminDashboardhousingMatchView', {
  path: '/housingMatch',
  template: 'housingMatchListView',
  controller: AppController,
  authorize: {
    allow() {
      return Roles.userIsInRole(Meteor.userId(), DefaultAdminAccessRoles);
    },
  },
  waitOn() {
    return [
      Meteor.subscribe('housingUnits.list', false),
      // Meteor.subscribe('projects.all'),
      Meteor.subscribe('housingMatch.list'),
    ];
  },
  data() {
    return {
      title: 'Housing Match',
      subtitle: 'View',
    };
  },
});
