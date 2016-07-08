/**
 * Created by Anush-PC on 5/13/2016.
 */
Template.LogSurvey.events(
  {
    'click .nextLogSurvey': (evt, tmpl) => {
      const surveyID = tmpl.find('.surveyList').value;
      const clientID = Router.current().params._id;

      const query = {};

      if (Router.current().params && Router.current().params.query
          && Router.current().params.query.isHMISClient && Router.current().params.query.link) {
        const url = encodeURIComponent(Router.current().params.query.link);
        query.query = {
          isHMISClient: true,
          link: url,
        };
        // query.query = `isHMISClient=true&link=${url}`;
      }

      Router.go(
        'LogSurveyResponse', { _id: clientID, survey_id: surveyID }, query
      );
    },
  }
);
let responseId;

function getAge(dob) {
  const date = new Date(dob);
  const ageDifMs = Date.now() - date.getTime();
  const ageDate = new Date(ageDifMs); // miliseconds from epoch
  return (Math.abs(ageDate.getUTCFullYear() - 1970));
}

function isHoH(reltohoh) {
  let status;
  if (reltohoh === '1') {
    status = true;
  } else {
    status = false;
  }
  return status;
}

function getAudience() {
  const data = Router.current().data();
  const client = data.client;

  let age;
  let isHead;
  let audience;
  if (client.dob !== '') { age = getAge(parseInt(client.dob, 10)); }
  if (client.relationship !== '') { isHead = isHoH(client.relationship); }
  if (isHead) {
    if (age >= 18) {
      audience = 'bothadultsandhoh';
    } else {
      audience = 'hoh';
    }
  } else {
    if (age >= 18) {
      audience = 'adult';
    } else if (age < 18) {
      audience = 'child';
    } else {
      audience = 'everyone';
    }
  }
  return audience;
}

function getQuestionName(getQuesName) {
  const questionCollection = adminCollectionObject('questions');
  const questions = questionCollection.findOne(
    { _id: getQuesName }
  );

  return questions;
}
function checkAudience(qid) {
  const questionCollection = adminCollectionObject('questions');
  const questions = questionCollection.find({ _id: qid }, { audience: 1, _id: 0 }).fetch();

  // let flag = false;

  for (let k = 0; k < questions.length; k ++) {
    // flag = questions[k].audience === Router.current().params.query.audience;
    break;
  }

  // Todo: Fix Audience
//  return flag;
  return true;
}

function saveSurvey(status, tmpl) {
  const surveyQuestionsMasterCollection = adminCollectionObject('surveyQuestionsMaster');
  const surveyDocument = surveyQuestionsMasterCollection.find(
    { surveyID: tmpl.data.survey._id }
  ).fetch();
  const mainSectionObject = [];
  for (let i = 0; i < surveyDocument.length; i ++) {
    const type = surveyDocument[i].contentType;
    if (type === 'section') {
      const sectionObject = {};
      const answerObject = [];
      const sectionQuestions = surveyQuestionsMasterCollection.find(
        { sectionID: surveyDocument[i]._id }
      ).fetch();
      if ($(`#${surveyDocument[i]._id}`).is(':checked')) {
        sectionObject.sectionID = surveyDocument[i]._id;
        sectionObject.name = surveyDocument[i].content;
        sectionObject.skip = true;
        mainSectionObject.push(sectionObject);
        continue;
      } else {
        for (let j = 0; j < sectionQuestions.length; j ++) {
          const stype = sectionQuestions[j].contentType;
          if (stype !== 'labels') {
            if (checkAudience(sectionQuestions[j].content)) {
              const question = getQuestionName(sectionQuestions[j].content);
              const questionObject = {};
              let answer = '';
              if ((question.dataType === 'Single Select') || (question.dataType === 'Boolean')) {
                answer = $(`input:radio[name=${question._id}]:checked`).val();
              } else if (question.dataType === 'Multiple Select') {
                $(`input:checkbox[name=${question._id}]:checked`).each(
                  (k, item) => {
                    answer += `${$(item).val()}|`;
                  }
                );
                answer = answer.substr(0, answer.length - 1);
              } else {
                answer = tmpl.find(`#${question._id}`).value;
              }
              if ((answer === null) || (answer === '') || (answer === undefined)) {
                if (status === 'Submit') {
                  if ($(`#${sectionQuestions[j].sectionID}`).is(':checked')) {
                    questionObject.questionID = question._id;
                    questionObject.answer = answer;
                    answerObject.push(questionObject);
                  } else {
                    alert(
                      /* eslint-disable */
                      `${surveyDocument[i].content} section is incomplete.Please fill all the fields in this section`
                      /* eslint-enable */
                    );
                    return;
                  }
                }
              } else {
                questionObject.questionID = question._id;
                questionObject.answer = answer;
                answerObject.push(questionObject);
              }
            }
          }
        }
        if (answerObject.length !== 0) {
          sectionObject.sectionID = surveyDocument[i]._id;
          sectionObject.name = surveyDocument[i].content;
          sectionObject.skip = false;
          sectionObject.response = answerObject;
          mainSectionObject.push(sectionObject);
        }
      }
    }
  }
  if (status === 'Submit') {
    const data = Router.current().data();
    const client = data.client;
    Meteor.call(
      'addSurveyResponse',
      tmpl.data.survey._id,
      client._id,
      getAudience(),
      Meteor.userId(),
      mainSectionObject,
      'Completed',
      (error, result) => {
        logger.log('Survey Saved completed!');
        if (error) {
          logger.log(error);
        } else {
          logger.log(result);
        }
      }
    );
    alert('Survey Saved!');
  } else if (status === 'Paused') {
    const data = Router.current().data();
    const client = data.client;
    Meteor.call(
      'addSurveyResponse',
      tmpl.data.survey._id,
      client._id,
      getAudience(),
      Meteor.userId(),
      mainSectionObject,
      'Paused',
      (error, result) => {
        logger.log('Survey Paused completed!');
        if (error) {
          logger.log(error);
        } else {
          logger.log(result);
          responseId = result;
          logger.log(`RID: ${responseId}`);
        }
      }
    );
    alert('Survey Paused!');
  }
  Router.go('surveyStatus');
}

function savePausedSurvey(status, tmpl) {
  const responsesCollection = adminCollectionObject('responses');
  const responseDocument = responsesCollection.find({ _id: tmpl.data._id }).fetch();

  let surveyId = '';
  let clientId = '';

  for (let i = 0; i < responseDocument.length; i++) {
    surveyId = responseDocument[i].surveyID;
    clientId = responseDocument[i].clientID;
  }

  const surveyQuestionsMasterCollection = adminCollectionObject('surveyQuestionsMaster');
  const surveyDocument = surveyQuestionsMasterCollection.find({ surveyID: surveyId }).fetch();
  const mainSectionObject = [];
  for (let i = 0; i < surveyDocument.length; i++) {
    const type = surveyDocument[i].contentType;
    if (type === 'section') {
      const sectionObject = {};
      const answerObject = [];
      const sectionQuestions = surveyQuestionsMasterCollection.find(
        { sectionID: surveyDocument[i]._id }
      ).fetch();
      if ($(`#${surveyDocument[i]._id}`).is(':checked')) {
        sectionObject.sectionID = surveyDocument[i]._id;
        sectionObject.name = surveyDocument[i].content;
        sectionObject.skip = true;
        mainSectionObject.push(sectionObject);
        continue;
      } else {
        for (let j = 0; j < sectionQuestions.length; j++) {
          const stype = sectionQuestions[j].contentType;
          if (stype !== 'labels') {
            if (checkAudience(sectionQuestions[j].content)) {
              const question = getQuestionName(sectionQuestions[j].content);
              const questionObject = {};
              let answer = '';
              if ((question.dataType === 'Single Select') || (question.dataType === 'Boolean')) {
                answer = $(`input:radio[name=${question._id}]:checked`).val();
              } else if (question.dataType === 'Multiple Select') {
                $(`input:checkbox[name=${question._id}]:checked`).each(
                  (k, item) => {
                    answer += `${$(item).val()}|`;
                  }
                );
                answer = answer.substr(0, answer.length - 1);
              } else {
                answer = tmpl.find(`#${question._id}`).value;
              }

              if ((answer === null) || (answer === '') || (answer === undefined)) {
                if (status === 'Pause_Submit') {
                  if ($(`#${sectionQuestions[j].sectionID}`).is(':checked')) {
                    questionObject.questionID = question._id;
                    questionObject.answer = answer;
                    answerObject.push(questionObject);
                  } else {
                    alert(
                      /* eslint-disable */
                      `${surveyDocument[i].content} section is incomplete.Please fill all the fields in this section`
                      /* eslint-enable */
                    );
                    return;
                  }
                }
              } else {
                questionObject.questionID = question._id;
                questionObject.answer = answer;
                answerObject.push(questionObject);
              }
            }
          }
        }
        if (answerObject.length !== 0) {
          sectionObject.sectionID = surveyDocument[i]._id;
          sectionObject.name = surveyDocument[i].content;
          sectionObject.skip = false;
          sectionObject.response = answerObject;
          mainSectionObject.push(sectionObject);
        }
      }
    }
  }
  if (status === 'Pause_Submit') {
    Meteor.call(
      'updateSurveyResponse',
      tmpl.data._id,
      surveyId,
      clientId,
      Meteor.userId(),
      mainSectionObject,
      'Completed',
      (error, result) => {
        if (error) {
          logger.log(error);
        } else {
          logger.log(result);
        }
      }
    );
    alert('Survey Saved!');
  } else if (status === 'Pause_Paused') {
    Meteor.call(
      'updateSurveyResponse',
      tmpl.data._id,
      surveyId,
      clientId,
      Meteor.userId(),
      mainSectionObject,
      'Paused',
      (error, result) => {
        if (error) {
          logger.log(error);
        } else {
          logger.log(result);
        }
      }
    );
    alert('Survey Paused!');
  }
  Router.go('surveyStatus');
}

Template.LogSurveyResponse.events(
  {
    'change .hideWhenSkipped': (evt) => {
      const toggleSkip = $(`#${evt.target.id}`).is(':checked');
      if (toggleSkip) {
        $(`.${evt.target.id}`).hide();
      } else {
        $(`.${evt.target.id}`).show();
      }
    },
    'change .singleSelect': (evt, tmpl) => {
      const element = tmpl.find('input:radio[name=singleSelect]:checked');
      const optionValue = $(element).val();

      if (optionValue === 'others' || optionValue === 'Others') {
        $('.othersSpecify_single').removeClass('hide');
      } else {
        $('.othersSpecify_single').addClass('hide');
      }
    },
    'change .multipleSelect': (evt, tmpl) => {
      const element = tmpl.find('input:checkbox[name=multipleSelect]:checked');
      const optionValue = $(element).val();

      if (optionValue === 'others' || optionValue === 'Others') {
        $('.othersSpecify_multiple').removeClass('hide');
      } else {
        $('.othersSpecify_multiple').addClass('hide');
      }
    },
    'click .pause_survey': (evt, tmpl) => {
      saveSurvey('Paused', tmpl);
    },
    'click .save_survey': (evt, tmpl) => {
      saveSurvey('Submit', tmpl);
    },
    'click .js-take-photo'(event) {
      event.preventDefault();
      logger.log('clicked picture button');
      MeteorCamera.getPicture({}, (error, data) => {
        if (error) {
          logger.log(error);
        } else {
          $(event.currentTarget).closest('.quesList').find('.survey-single-photo-img').attr('src', data);
          $(event.currentTarget).closest('.quesList').find('.survey-single-photo-value').val(data);
          $(event.currentTarget).closest('.quesList').find('.js-remove-photo').removeClass('hide');
        }
      });
    },
    'click .js-remove-photo'(event) {
      event.preventDefault();
      logger.log('clicked remove picture button');
      $(event.currentTarget).closest('.quesList').find('.survey-single-photo-img').attr('src', '');
      $(event.currentTarget).closest('.quesList').find('.survey-single-photo-value').val('');
      $(event.currentTarget).closest('.quesList').find('.js-remove-photo').addClass('hide');
    },
  }
);

Template.LogSurveyView.events(
  {
    'change .hideWhenSkipped': (evt) => {
      const toggleSkip = $(`#${evt.target.id}`).is(':checked');
      if (toggleSkip) {
        $(`.${evt.target.id}`).hide();
      } else {
        $(`.${evt.target.id}`).show();
      }
    },

    'click .savePaused_survey': (evt, tmpl) => {
      savePausedSurvey('Pause_Submit', tmpl);
    },
    'click .pausePaused_survey': (evt, tmpl) => {
      savePausedSurvey('Pause_Paused', tmpl);
    },

    'click .js-take-photo'(event) {
      event.preventDefault();
      logger.log('clicked picture button');
      MeteorCamera.getPicture({}, (error, data) => {
        if (error) {
          logger.log(error);
        } else {
          $(event.currentTarget).closest('.quesList').find('.survey-single-photo-img').attr('src', data);
          $(event.currentTarget).closest('.quesList').find('.survey-single-photo-value').val(data);
          $(event.currentTarget).closest('.quesList').find('.js-remove-photo').removeClass('hide');
        }
      });
    },
    'click .js-remove-photo'(event) {
      event.preventDefault();
      logger.log('clicked remove picture button');
      $(event.currentTarget).closest('.quesList').find('.survey-single-photo-img').attr('src', '');
      $(event.currentTarget).closest('.quesList').find('.survey-single-photo-value').val('');
      $(event.currentTarget).closest('.quesList').find('.js-remove-photo').addClass('hide');
    },
  }
);
