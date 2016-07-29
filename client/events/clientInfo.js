/**
 * Created by Kavi on 4/5/16.
 */
const querystring = require('querystring');

Template.clientForm.events(
  {
    'change #js-photo-input'() {
      const file = document.querySelector('#js-photo-input').files[0];
      const reader = new FileReader();

      reader.addEventListener('load', () => {
        $('#client-photo-img').attr('src', reader.result);
        $('#client-photo-value').val(reader.result);
      }, false);

      if (file) {
        reader.readAsDataURL(file);
      }
    },
    'click #js-take-photo'(event) {
      event.preventDefault();
      logger.log('clicked picture button');
      MeteorCamera.getPicture({}, (error, data) => {
        if (error) {
          logger.log(error);
        } else {
          $('#client-photo-img').attr('src', data);
          $('#client-photo-value').val(data);
          $('#js-remove-photo').removeClass('hide');
        }
      });
    },
    'click #js-remove-photo'(event) {
      event.preventDefault();
      logger.log('clicked remove picture button');
      $('#client-photo-img').attr('src', '');
      $('#client-photo-value').val('');
      $('#js-remove-photo').addClass('hide');
    },
  }
);

Template.createClient.events(
  {
    'click .save'(evt, tmpl) {
      const firstName = tmpl.find('.firstName').value;
      const middleName = tmpl.find('.middleName').value;
      const lastName = tmpl.find('.lastName').value;
      const suffix = tmpl.find('.suffix').value;
      const photo = tmpl.find('.photo').value;
      const ssn = tmpl.find('.ssn').value;
      const dob = tmpl.find('.dob').value;
      const race = tmpl.find('.race_category').value;
      const ethnicity = tmpl.find('.ethnicity_category').value;
      const gender = tmpl.find('.gender_category').value;
      const veteranStatus = tmpl.find('.veteranStatus_category').value;
      const disablingConditions = tmpl.find('.disablingConditions_category').value;
      const residencePrior = tmpl.find('.residencePrior_category').value;
      const entryDate = tmpl.find('.entryDate').value;
      const exitDate = tmpl.find('.exitDate').value;
      const destination = tmpl.find('.destinationCategory').value;
      const relationship = tmpl.find('.relationtoHoH_category').value;
      const loc = tmpl.find('.loc').value;
      const shelter = tmpl.find('.timeOnStreets_category').value;
      const signature = tmpl.find('.signature') ? tmpl.find('.signature').value : '';
      Meteor.call(
        'addClient', firstName, middleName, lastName, suffix, photo, ssn,
        dob, race, ethnicity, gender, veteranStatus, disablingConditions, residencePrior, entryDate,
        exitDate, destination, relationship, loc, shelter, signature,
        (error, result) => {
          if (error) {
            // console.log(error);
          } else {
            const clientId = result;
            // console.log(result);
            Router.go('viewClient', { _id: clientId });
          }
        }
      );
    },
  }
);

Template.viewClient.onRendered(() => {
  $('body').tooltip({ selector: '.js-tooltip' });
});

Template.viewClient.events(
  {
    'click .edit'(evt, tmpl) {
      const query = {};
      if (tmpl.data.isHMISClient) {
        query.query = 'isHMISClient=true';
      }
      Router.go('editClient', { _id: tmpl.data._id }, query);
    },
    'click .back'() {
      Router.go('searchClient');
    },
    'click .add-to-hmis'(event, tmpl) {
      Meteor.call(
        'addClientToHMIS', tmpl.data._id, (error, result) => {
          if (error) {
            logger.log(error);
          } else {
            let query = 'addClientToHMISError=1';
            let clientId = tmpl.data._id;
            if (result) {
              const params = {
                addedToHMIS: 1,
                isHMISClient: true,
                link: result.link,
              };
              clientId = result._id;
              query = querystring.stringify(params);
            }

            Router.go('viewClient', { _id: clientId }, { query });
          }
        }
      );
    },
    'click .takeSurvey'(event, tmpl) {
      const query = {};

      if (Router.current().params && Router.current().params.query
        && Router.current().params.query.isHMISClient && Router.current().params.query.link) {
        const url = encodeURIComponent(Router.current().params.query.link);
        query.query = {
          isHMISClient: true,
          link: url,
        };
        // `isHMISClient=true&link=${url}`
      }

      Router.go('LogSurvey', { _id: tmpl.data._id }, query);
    },
  }
);

Template.editClient.events(
  {
    'click .update'(evt, tmpl) {
      const firstName = tmpl.find('.firstName').value;
      const middleName = tmpl.find('.middleName').value;
      const lastName = tmpl.find('.lastName').value;
      const suffix = tmpl.find('.suffix').value;
      const photo = tmpl.find('.photo').value;
      const ssn = tmpl.find('.ssn').value;
      const dob = tmpl.find('.dob').value;
      const race = tmpl.find('.race_category').value;
      const ethnicity = tmpl.find('.ethnicity_category').value;
      const gender = tmpl.find('.gender_category').value;
      const veteranStatus = tmpl.find('.veteranStatus_category').value;
      const disablingConditions = tmpl.find('.disablingConditions_category').value;
      const residencePrior = tmpl.find('.residencePrior_category').value;
      const entryDate = tmpl.find('.entryDate').value;
      const exitDate = tmpl.find('.exitDate').value;
      const destination = tmpl.find('.destinationCategory').value;
      const relationship = tmpl.find('.relationtoHoH_category').value;
      const loc = tmpl.find('.loc').value;
      const shelter = tmpl.find('.timeOnStreets_category').value;
      Meteor.call(
        'updateClient', tmpl.data._id, firstName, middleName, lastName,
        suffix, photo, ssn, dob, race, ethnicity, gender, veteranStatus,
        disablingConditions, residencePrior, entryDate, exitDate, destination,
        relationship, loc,
        shelter,
        (error, result) => {
          if (error) {
            logger.log(error);
          } else {
            logger.log(result);
            Router.go('viewClient', { _id: tmpl.data._id });
          }
        }
      );
    },
    'click .delete'(evt, tmpl) {
      Meteor.call(
        'removeClient', tmpl.data._id, (error) => {
          if (error) {
            // console.log(error);
          } else {
            // console.log(result);
            Router.go('searchClient', {}, { query: 'deleted=1' });
          }
        }
      );
    },
    'click .back'(evt, tmpl) {
      Router.go('viewClient', { _id: tmpl.data._id });
    },
  }
);
