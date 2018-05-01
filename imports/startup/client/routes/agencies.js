import { ableToAccess } from '/imports/api/rolePermissions/helpers.js';
import Agencies from '/imports/api/agencies/agencies';
import { AppController } from './controllers';
import '/imports/ui/agencies/agenciesListView';
import '/imports/ui/agencies/agenciesNew';
import '/imports/ui/agencies/agenciesEdit';

Router.route(
  'agenciesList', {
    path: '/agencies',
    template: Template.agenciesListView,
    controller: AppController,
    authorize: {
      allow() {
        return ableToAccess(Meteor.userId(), 'accessAgencies');
      },
    },
    waitOn() {
      return [
        Meteor.subscribe('rolePermissions.all'),
        Meteor.subscribe('agencies.all'),
      ];
    },
    data() {
      return {
        title: 'Agencies',
        subtitle: 'List',
      };
    },
  }
);

Router.route(
  'agenciesNew', {
    path: '/agencies/new',
    template: Template.agenciesNew,
    controller: AppController,
    authorize: {
      allow() {
        return ableToAccess(Meteor.userId(), 'accessAgencies');
      },
    },
    waitOn() {
      return [
        Meteor.subscribe('rolePermissions.all'),
        Meteor.subscribe('projects.all'),
        Meteor.subscribe('users.all'),
      ];
    },
    data() {
      return {
        title: 'Agencies',
        subtitle: 'New',
        doc: {},
      };
    },
  }
);

Router.route(
  'agenciesEdit', {
    path: '/agencies/:_id/edit',
    template: Template.agenciesEdit,
    controller: AppController,
    authorize: {
      allow() {
        return ableToAccess(Meteor.userId(), 'accessAgencies');
      },
    },
    waitOn() {
      const id = Router.current().params._id;
      return [
        Meteor.subscribe('rolePermissions.all'),
        Meteor.subscribe('agencies.one', id),
        Meteor.subscribe('projects.all'),
        Meteor.subscribe('users.all'),
      ];
    },
    data() {
      const id = Router.current().params._id;

      return {
        title: 'Agencies',
        subtitle: 'Edit',
        doc: Agencies.findOne(id),
      };
    },
  }
);
