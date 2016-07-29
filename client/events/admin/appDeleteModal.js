/**
 * Created by udit on 27/07/16.
 */

Template.AppDeleteModal.events({
  'click #confirm-delete'() {
    const collection = Session.get('admin_collection_name');
    const _id = Session.get('admin_id');
    Meteor.call('adminRemoveDoc', collection, _id, (e, r) => {
      logger.log(e);
      logger.log(r);
    });
    $('#app-delete-modal').modal('hide');
  },
});