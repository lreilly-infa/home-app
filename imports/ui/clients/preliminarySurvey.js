import OpeningScript from '/imports/api/openingScript/openingScript';
import SignaturePadConfig from '/imports/ui/signaturePadConfig';
import './signaturePad.js';
import './preliminarySurvey.html';


Template.preliminarySurvey.helpers({
  skipDvQuestion() {
    return OpeningScript.skipDvQuestion();
  },
  dvQuestion() {
    return OpeningScript.dvQuestion();
  },
  skipHousingServiceQuestion() {
    return OpeningScript.skipHousingServiceQuestion();
  },
  housingServiceQuestion() {
    return OpeningScript.housingServiceQuestion();
  },
  hotlineInfo() {
    return OpeningScript.hotlineInfo();
  },
  releaseOfInformation() {
    return OpeningScript.releaseOfInformation();
  },
});

Template.preliminarySurvey.events(
  {
    'click .js-close-preliminary-survey-modal': (event) => {
      event.preventDefault();
      $('#preliminarySurveyModal').modal('hide');
    },
    'click .js-goto-dashboard': (event) => {
      event.preventDefault();
      Router.go('dashboard');
    },
    'click .js-open-release-of-info-modal': (event) => {
      event.preventDefault();
      if (!OpeningScript.skipReleaseOfInformation()) {
        $('#releaseOfInformationModal').modal(
          {
            keyboard: false,
            backdrop: false,
          }
        );
        SignaturePadConfig.resizeCanvas();
      }
    },
    'submit #release-of-information': (event) => {
      event.preventDefault();
      const signaturePad = Router.current().params.signaturePad;
      if (signaturePad.isEmpty()) {
        Bert.alert('Please provide signature first.', 'error', 'growl-top-right');
      } else {
        $('#create-client-form .signature').val(signaturePad.toDataURL());
        $('#create-client-form .signature-img').attr('src', signaturePad.toDataURL());
        $('#releaseOfInformationModal').modal('hide');
      }
      return false;
    },
  }
);
