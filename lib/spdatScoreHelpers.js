import { logger } from '/imports/utils/logger';
import { getSurveySections } from '/imports/api/surveys/helpers';
import Questions from '/imports/api/questions/questions';
import Responses from '/imports/api/responses/responses';
import SurveyQuestionsMaster from '/imports/api/surveys/surveyQuestionsMaster';

spdatScoreHelpers = {
  getAnswer(questionId, dataType) {
    let answer = '';
    if ((dataType === 'Single Select') || (dataType === 'Boolean')) {
      answer = $(`input[type='radio'][name="${questionId}"]:checked`).val().toLowerCase();
    } else if (dataType === 'Multiple Select') {
      $(`input[type='checkbox'][name=${questionId}]:checked`).each(
        (k, item) => {
          answer += `${$(item).val()}|`;
        }
      );
      answer = answer.substr(0, answer.length - 1);
    } else if (dataType === 'wysiwyg') {
      if ($(`#${questionId}`).summernote('code') !== '<p><br></p>') {
        answer = $(`#${questionId}`).summernote('code');
      }
    } else if (dataType === 'mtv') {
      let option;
      option = '';
      $(`#aoptions${questionId}`).find('tr').each((k, item) => {
        if (option === '') {
          option = $(item).find('.description').val();
        } else {
          const op = $(item).find('.description').val();
          option += `|${$.trim(op)}`;
        }
      });
      if (option !== '') {
        answer = option;
      }
    } else if (dataType === 'date') {
      answer = $(`#${questionId} input`).val();
    } else if (dataType === 'label') {
      answer = 'This answer should be ignored as it\'s just a label';
    } else if (dataType === 'Textbox(Integer)') {
      // send in integer format.
      answer = parseInt($(`input[type='number'][name="${questionId}"]`).val(), 10) || 0;
    } else {
      answer = $(`input[name="${questionId}"]`).val();
    }
    return answer;
  },
  getAnswerFromDb(responseId, questionId, dataType) {
    const response = Responses.findOne({ _id: responseId });
    for (let i = 0; i < response.section.length; i += 1) {
      for (let j = 0; response.section[i].skip === false &&
        j < response.section[i].response.length; j += 1) {
        if (response.section[i].response[j].questionID === questionId) {
          if (dataType === 'TextBox(Integer)') {
            return parseInt(response.section[i].response[j].answer, 10);
          } else if (dataType === 'Date') {
            return Date.parse(response.section[i].response[j].answer);
          }
          return response.section[i].response[j].answer.toLowerCase();
        }
      }
    }
    return 0;
  },
  calcSpdatTayScore(surveyId, responseId = '', fromDb = false) {
    // Get all sections of this survey.
    const surveySections = getSurveySections(surveyId);
    // Initializing the sectionScores as defined in API - Survey Service 1.0.0
    const sectionScores = [];
    for (let i = 0; i < 5; i += 1) {
      const sectionId = '';
      const sectionScore = 0;
      const temp = { sectionId, sectionScore };
      sectionScores.push(temp);
    }
    // Find sections relevant for scoring.
    for (let i = 0; i < surveySections.length; i += 1) {
      // For Basic Information.
      if (sectionScores[0].sectionScore === 0) {
        if (/basic/i.test(surveySections[i].content)) {
          // Fetch all questions from this section which need to be scored.
          sectionScores[0].sectionId = surveySections[i].apiSurveyServiceId;
          const qIds = _.pluck(SurveyQuestionsMaster.find(
            { $and: [
              { sectionID: surveySections[i]._id },
              { surveyID: surveyId },
            ] },
            { fields: { _id: 0, content: 1 } }
          ).fetch(), 'content');
          const Age = Questions.findOne(
            { $and: [
              { _id: { $in: qIds } },
              { question: { $regex: /^age/i } },
            ] }, { fields: { _id: 1, dataType: 1 } }
          );
          // Get their answers from UI and score them according to response
          let ansAge = '';
          if (fromDb) {
            ansAge = spdatScoreHelpers.getAnswerFromDb(responseId, Age._id, Age.dataType);
            logger.error(`AnsAge: ${ansAge}`);
          } else {
            ansAge = spdatScoreHelpers.getAnswer(Age._id, Age.dataType);
          }
          // Save the value to section Scores.
          if (ansAge <= 17 || parseInt(ansAge, 10) <= 17) {
            sectionScores[0].sectionScore += 1;
          }
        }
      }
      // For Section A: HISTORY OF HOUSING & HOMELESSNESS.
      if (sectionScores[1].sectionScore === 0) {
        if (/homelessness/i.test(surveySections[i].content)) {
          sectionScores[1].sectionId = surveySections[i].apiSurveyServiceId;
          const qIds = _.pluck(SurveyQuestionsMaster.find(
            { $and: [
              { sectionID: surveySections[i]._id },
              { surveyID: surveyId },
            ] },
            { fields: { _id: 0, content: 1 } }
          ).fetch(), 'content');
          // Get all questions and search them accordingly.
          const Q1 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /sleep/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ1;
          if (fromDb) {
            ansQ1 = spdatScoreHelpers.getAnswerFromDb(responseId, Q1._id, Q1.dataType);
          } else {
            ansQ1 = spdatScoreHelpers.getAnswer(Q1._id, Q1.dataType);
          }
          logger.log(`${ansQ1} - ${typeof ansQ1}`);
          if (!(/shelter/.test(ansQ1.toLowerCase())) &&
            !(/safe haven/.test(ansQ1.toLowerCase())) &&
            !(/transitional housing/.test(ansQ1.toLowerCase()))) {
            sectionScores[1].sectionScore += 1;
            logger.log(`Q1: ${Q1._id}`);
          }
          const Q2 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /stable housing/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ2;
          if (fromDb) {
            ansQ2 = spdatScoreHelpers.getAnswerFromDb(responseId, Q2._id, Q2.dataType);
          } else {
            ansQ2 = spdatScoreHelpers.getAnswer(Q2._id, Q2.dataType);
          }
          logger.log(`2. ${ansQ2} - ${typeof ansQ2}`);
          const Q3 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /last three years/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ3;
          if (fromDb) {
            ansQ3 = spdatScoreHelpers.getAnswerFromDb(responseId, Q3._id, Q3.dataType);
          } else {
            ansQ3 = spdatScoreHelpers.getAnswer(Q3._id, Q3.dataType);
          }
          logger.log(`3. ${ansQ3} - ${typeof ansQ3}`);
          if (ansQ2 >= 1 || parseInt(ansQ2, 10) >= 1 || ansQ3 > 4 || parseInt(ansQ3, 10) > 4) {
            logger.log(`Q2, 3: ${ansQ2} ${ansQ2}`);
            sectionScores[1].sectionScore += 1;
          }
        }
      }
      // For Section B: RISKS.
      if (sectionScores[2].sectionScore === 0) {
        if (/risk/i.test(surveySections[i].content)) {
          sectionScores[2].sectionId = surveySections[i].apiSurveyServiceId;
          const qIds = _.pluck(SurveyQuestionsMaster.find(
            { $and: [
              { sectionID: surveySections[i]._id },
              { surveyID: surveyId },
            ] },
            { fields: { _id: 0, content: 1 } }
          ).fetch(), 'content');
          // EMERGENCY SERVICE USE
          const Q4a = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /health care/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ4a;
          if (fromDb) {
            ansQ4a = spdatScoreHelpers.getAnswerFromDb(responseId, Q4a._id, Q4a.dataType);
          } else {
            ansQ4a = spdatScoreHelpers.getAnswer(Q4a._id, Q4a.dataType);
          }
          logger.log(`4. ${ansQ4a} - ${typeof ansQ4a}`);
          const Q4b = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /ambulance/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ4b;
          if (fromDb) {
            ansQ4b = spdatScoreHelpers.getAnswerFromDb(responseId, Q4b._id, Q4b.dataType);
          } else {
            ansQ4b = spdatScoreHelpers.getAnswer(Q4b._id, Q4b.dataType);
          }
          logger.log(`${ansQ4b} - ${typeof ansQ4b}`);
          const Q4c = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /hospitalized/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ4c;
          if (fromDb) {
            ansQ4c = spdatScoreHelpers.getAnswerFromDb(responseId, Q4c._id, Q4c.dataType);
          } else {
            ansQ4c = spdatScoreHelpers.getAnswer(Q4c._id, Q4c.dataType);
          }
          logger.log(`${ansQ4c} - ${typeof ansQ4c}`);
          const Q4d = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /crisis service/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ4d;
          if (fromDb) {
            ansQ4d = spdatScoreHelpers.getAnswerFromDb(responseId, Q4d._id, Q4d.dataType);
          } else {
            ansQ4d = spdatScoreHelpers.getAnswer(Q4d._id, Q4d.dataType);
          }
          logger.log(`${ansQ4d} - ${typeof ansQ4d}`);
          const Q4e = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /police/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ4e;
          if (fromDb) {
            ansQ4e = spdatScoreHelpers.getAnswerFromDb(responseId, Q4e._id, Q4e.dataType);
          } else {
            ansQ4e = spdatScoreHelpers.getAnswer(Q4e._id, Q4e.dataType);
          }
          logger.log(`${ansQ4e} - ${typeof ansQ4e}`);
          const Q4f = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /serious offence/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ4f;
          if (fromDb) {
            ansQ4f = spdatScoreHelpers.getAnswerFromDb(responseId, Q4f._id, Q4f.dataType);
          } else {
            ansQ4f = spdatScoreHelpers.getAnswer(Q4f._id, Q4f.dataType);
          }
          logger.log(`${ansQ4f} - ${typeof ansQ4f}`);
          if ((ansQ4a + ansQ4b + ansQ4c + ansQ4d + ansQ4e + ansQ4f) >= 4) {
            sectionScores[2].sectionScore += 1;
          }
          // RISK OF HARM.
          const Q5 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /beaten up/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ5;
          if (fromDb) {
            ansQ5 = spdatScoreHelpers.getAnswerFromDb(responseId, Q5._id, Q5.dataType);
          } else {
            ansQ5 = spdatScoreHelpers.getAnswer(Q5._id, Q5.dataType);   // lowercase 'y'
          }
          logger.log(`5. ${ansQ5} - ${typeof ansQ5}`);
          const Q6 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /to harm yourself/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ6;
          if (fromDb) {
            ansQ6 = spdatScoreHelpers.getAnswerFromDb(responseId, Q6._id, Q6.dataType);
          } else {
            ansQ6 = spdatScoreHelpers.getAnswer(Q6._id, Q6.dataType);   // lowercase 'y'
          }
          logger.log(`6. ${ansQ6} - ${typeof ansQ6}`);
          if (ansQ5 === 'y' || ansQ6 === 'y' || ansQ5 === 'yes' || ansQ6 === 'yes') {
            sectionScores[2].sectionScore += 1;
          }
          // LEGAL ISSUES.
          const Q7 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /legal stuff/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ7;
          if (fromDb) {
            ansQ7 = spdatScoreHelpers.getAnswerFromDb(responseId, Q7._id, Q7.dataType);
          } else {
            ansQ7 = spdatScoreHelpers.getAnswer(Q7._id, Q7.dataType);   // lowercase 'y'
          }
          logger.log(`7. ${ansQ7} - ${typeof ansQ7}`);
          const Q8 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /incarcerated/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ8;
          if (fromDb) {
            ansQ8 = spdatScoreHelpers.getAnswerFromDb(responseId, Q8._id, Q8.dataType);
          } else {
            ansQ8 = spdatScoreHelpers.getAnswer(Q8._id, Q8.dataType);   // lowercase 'y'
          }
          logger.log(`8. ${ansQ8} - ${typeof ansQ8}`);
          if (ansQ7 === 'y' || ansQ8 === 'y' || ansQ7 === 'yes' || ansQ8 === 'yes') {
            sectionScores[2].sectionScore += 1;
          }
          // RISK OF EXPLOITATION.
          const Q9 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /force or trick/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ9;
          if (fromDb) {
            ansQ9 = spdatScoreHelpers.getAnswerFromDb(responseId, Q9._id, Q9.dataType);
          } else {
            ansQ9 = spdatScoreHelpers.getAnswer(Q9._id, Q9.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ9} - ${typeof ansQ9}`);
          const Q10 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /sex for money/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ10;
          if (fromDb) {
            ansQ10 = spdatScoreHelpers.getAnswerFromDb(responseId, Q10._id, Q10.dataType);
          } else {
            ansQ10 = spdatScoreHelpers.getAnswer(Q10._id, Q10.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ10} - ${typeof ansQ10}`);
          if (ansQ9 === 'y' || ansQ10 === 'y' || ansQ9 === 'yes' || ansQ10 === 'yes') {
            sectionScores[2].sectionScore += 1;
          }
        }
      }
      // For Section C: SOCIALIZATION & DAILY FUNCTIONS.
      if (sectionScores[3].sectionScore === 0) {
        if (/socialization/i.test(surveySections[i].content)) {
          sectionScores[3].sectionId = surveySections[i].apiSurveyServiceId;
          const qIds = _.pluck(SurveyQuestionsMaster.find(
            { $and: [
              { sectionID: surveySections[i]._id },
              { surveyID: surveyId },
            ] },
            { fields: { _id: 0, content: 1 } }
          ).fetch(), 'content');
          // MONEY MANAGEMENT.
          const Q11 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /past landlord/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ11;
          if (fromDb) {
            ansQ11 = spdatScoreHelpers.getAnswerFromDb(responseId, Q11._id, Q11.dataType);
          } else {
            ansQ11 = spdatScoreHelpers.getAnswer(Q11._id, Q11.dataType);   // lowercase 'y'
          }
          logger.log(`11. ${ansQ11} - ${typeof ansQ11}`);
          const Q12 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /from the government/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ12;
          if (fromDb) {
            ansQ12 = spdatScoreHelpers.getAnswerFromDb(responseId, Q12._id, Q12.dataType);
          } else {
            ansQ12 = spdatScoreHelpers.getAnswer(Q12._id, Q12.dataType);   // lowercase 'y'
          }
          logger.log(`12. ${ansQ12} - ${typeof ansQ12}`);
          if (ansQ11 === 'y' || ansQ12 === 'n' || ansQ11 === 'yes' || ansQ12 === 'no') {
            sectionScores[3].sectionScore += 1;
          }
          // MEANINGFUL DAILY ACTIVITY.
          const Q13 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /planned activities/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ13;
          if (fromDb) {
            ansQ13 = spdatScoreHelpers.getAnswerFromDb(responseId, Q13._id, Q13.dataType);
          } else {
            ansQ13 = spdatScoreHelpers.getAnswer(Q13._id, Q13.dataType);   // lowercase 'y'
          }
          logger.log(`13. ${ansQ13} - ${typeof ansQ13}`);
          if (ansQ13 === 'n' || ansQ13 === 'no') {
            sectionScores[3].sectionScore += 1;
          }
          // SELF-CARE.
          const Q14 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /care of basic needs/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ14;
          if (fromDb) {
            ansQ14 = spdatScoreHelpers.getAnswerFromDb(responseId, Q14._id, Q14.dataType);
          } else {
            ansQ14 = spdatScoreHelpers.getAnswer(Q14._id, Q14.dataType);   // lowercase 'y'
          }
          logger.log(`14. ${ansQ14} - ${typeof ansQ14}`);
          if (ansQ14 === 'n' || ansQ14 === 'no') {
            sectionScores[3].sectionScore += 1;
          }
          // SOCIAL RELATIONSHIPS.
          const Q15a = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /ran away/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ15a;
          if (fromDb) {
            ansQ15a = spdatScoreHelpers.getAnswerFromDb(responseId, Q15a._id, Q15a.dataType);
          } else {
            ansQ15a = spdatScoreHelpers.getAnswer(Q15a._id, Q15a.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ15a} - ${typeof ansQ15a}`);
          const Q15b = Questions.findOne(
            { $and: [
              { _id: { $in: qIds } },
              { question: { $regex: /difference in religious/i } },
            ] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ15b;
          if (fromDb) {
            ansQ15b = spdatScoreHelpers.getAnswerFromDb(responseId, Q15b._id, Q15b.dataType);
          } else {
            ansQ15b = spdatScoreHelpers.getAnswer(Q15b._id, Q15b.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ15b} - ${typeof ansQ15b}`);
          const Q15c = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /you to become homeless/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ15c;
          if (fromDb) {
            ansQ15c = spdatScoreHelpers.getAnswerFromDb(responseId, Q15c._id, Q15c.dataType);
          } else {
            ansQ15c = spdatScoreHelpers.getAnswer(Q15c._id, Q15c.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ15c} - ${typeof ansQ15c}`);
          const Q15d = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /gender identity/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ15d;
          if (fromDb) {
            ansQ15d = spdatScoreHelpers.getAnswerFromDb(responseId, Q15d._id, Q15d.dataType);
          } else {
            ansQ15d = spdatScoreHelpers.getAnswer(Q15d._id, Q15d.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ15d} - ${typeof ansQ15d}`);
          if (ansQ15a === 'y' || ansQ15a === 'yes' || ansQ15b === 'y' || ansQ15b === 'yes' ||
            ansQ15c === 'y' || ansQ15c === 'yes' || ansQ15d === 'y' || ansQ15d === 'yes') {
            sectionScores[3].sectionScore += 1;
          }
          // ABUSE/TRAUMA.
          const Q15e = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /violence at home/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ15e;
          if (fromDb) {
            ansQ15e = spdatScoreHelpers.getAnswerFromDb(responseId, Q15e._id, Q15e.dataType);
          } else {
            ansQ15e = spdatScoreHelpers.getAnswer(Q15e._id, Q15e.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ15e} - ${typeof ansQ15e}`);
          const Q15f = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /abusive relationship/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ15f;
          if (fromDb) {
            ansQ15f = spdatScoreHelpers.getAnswerFromDb(responseId, Q15f._id, Q15f.dataType);
          } else {
            ansQ15f = spdatScoreHelpers.getAnswer(Q15f._id, Q15f.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ15f} - ${typeof ansQ15f}`);
          if (ansQ15e === 'y' || ansQ15e === 'yes' || ansQ15f === 'y' || ansQ15f === 'yes') {
            sectionScores[3].sectionScore += 1;
          }
        }
      }
      // For Section D: WELLNESS.
      if (sectionScores[4].sectionScore === 0) {
        if (/wellness/i.test(surveySections[i].content)) {
          sectionScores[4].sectionId = surveySections[i].apiSurveyServiceId;
          logger.error(sectionScores[4].sectionId);
          const qIds = _.pluck(SurveyQuestionsMaster.find(
            { $and: [
              { sectionID: surveySections[i]._id },
              { surveyID: surveyId },
            ] },
            { fields: { _id: 0, content: 1 } }
          ).fetch(), 'content');
          let tri = 0;      // for Tri-Morbidity.
          // PHYSICAL HEALTH.
          const Q16 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /leave an apartment/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ16;
          if (fromDb) {
            ansQ16 = spdatScoreHelpers.getAnswerFromDb(responseId, Q16._id, Q16.dataType);
          } else {
            ansQ16 = spdatScoreHelpers.getAnswer(Q16._id, Q16.dataType);   // lowercase 'y'
          }
          logger.log(`16. ${ansQ16} - ${typeof ansQ16}`);
          const Q17 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /chronic health issues/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ17;
          if (fromDb) {
            ansQ17 = spdatScoreHelpers.getAnswerFromDb(responseId, Q17._id, Q17.dataType);
          } else {
            ansQ17 = spdatScoreHelpers.getAnswer(Q17._id, Q17.dataType);   // lowercase 'y'
          }
          logger.log(`17. ${ansQ17} - ${typeof ansQ17}`);
          const Q18 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /HIV or AIDS/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ18;
          if (fromDb) {
            ansQ18 = spdatScoreHelpers.getAnswerFromDb(responseId, Q18._id, Q18.dataType);
          } else {
            ansQ18 = spdatScoreHelpers.getAnswer(Q18._id, Q18.dataType);   // lowercase 'y'
          }
          logger.log(`18. ${ansQ18} - ${typeof ansQ18}`);
          const Q19 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /physical disabilities/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ19;
          if (fromDb) {
            ansQ19 = spdatScoreHelpers.getAnswerFromDb(responseId, Q19._id, Q19.dataType);
          } else {
            ansQ19 = spdatScoreHelpers.getAnswer(Q19._id, Q19.dataType);   // lowercase 'y'
          }
          logger.log(`19. ${ansQ19} - ${typeof ansQ19}`);
          const Q20 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /avoid getting medical/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ20;
          if (fromDb) {
            ansQ20 = spdatScoreHelpers.getAnswerFromDb(responseId, Q20._id, Q20.dataType);
          } else {
            ansQ20 = spdatScoreHelpers.getAnswer(Q20._id, Q20.dataType);   // lowercase 'y'
          }
          logger.log(`20. ${ansQ20} - ${typeof ansQ20}`);
          const Q21 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /pregnant/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ21;
          if (fromDb) {
            ansQ21 = spdatScoreHelpers.getAnswerFromDb(responseId, Q21._id, Q21.dataType);
          } else {
            ansQ21 = spdatScoreHelpers.getAnswer(Q21._id, Q21.dataType);   // lowercase 'y'
          }
          logger.log(`21. ${ansQ21} - ${typeof ansQ21}`);
          if (ansQ16 === 'y' || ansQ17 === 'y' || ansQ18 === 'y' || ansQ19 === 'y' ||
            ansQ20 === 'y' || ansQ21 === 'y' || ansQ16 === 'yes' || ansQ17 === 'yes' ||
            ansQ18 === 'yes' || ansQ19 === 'yes' || ansQ20 === 'yes' || ansQ21 === 'yes') {
            sectionScores[4].sectionScore += 1;
            tri += 1;
          }
          // SUBSTANCE USE.
          const Q22 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /staying in the past/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ22;
          if (fromDb) {
            ansQ22 = spdatScoreHelpers.getAnswerFromDb(responseId, Q22._id, Q22.dataType);
          } else {
            ansQ22 = spdatScoreHelpers.getAnswer(Q22._id, Q22.dataType);   // lowercase 'y'
          }
          logger.log(`22. ${ansQ22} - ${typeof ansQ22}`);
          const Q23 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /stay housed/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ23;
          if (fromDb) {
            ansQ23 = spdatScoreHelpers.getAnswerFromDb(responseId, Q23._id, Q23.dataType);
          } else {
            ansQ23 = spdatScoreHelpers.getAnswer(Q23._id, Q23.dataType);   // lowercase 'y'
          }
          logger.log(`23. ${ansQ23} - ${typeof ansQ23}`);
          const Q24 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /12 or younger/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ24;
          if (fromDb) {
            ansQ24 = spdatScoreHelpers.getAnswerFromDb(responseId, Q24._id, Q24.dataType);
          } else {
            ansQ24 = spdatScoreHelpers.getAnswer(Q24._id, Q24.dataType);   // lowercase 'y'
          }
          logger.log(`24. ${ansQ24} - ${typeof ansQ24}`);
          if (ansQ22 === 'y' || ansQ23 === 'y' || ansQ24 === 'y' ||
            ansQ22 === 'yes' || ansQ23 === 'yes' || ansQ24 === 'yes') {
            sectionScores[4].sectionScore += 1;
            tri += 1;
          }
          // MENTAL HEALTH.
          const Q25a = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /mental health issue/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ25a;
          if (fromDb) {
            ansQ25a = spdatScoreHelpers.getAnswerFromDb(responseId, Q25a._id, Q25a.dataType);
          } else {
            ansQ25a = spdatScoreHelpers.getAnswer(Q25a._id, Q25a.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ25a} - ${typeof ansQ25a}`);
          const Q25b = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /past head injury/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ25b;
          if (fromDb) {
            ansQ25b = spdatScoreHelpers.getAnswerFromDb(responseId, Q25b._id, Q25b.dataType);
          } else {
            ansQ25b = spdatScoreHelpers.getAnswer(Q25b._id, Q25b.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ25b} - ${typeof ansQ25b}`);
          const Q25c = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: / learning disability/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ25c;
          if (fromDb) {
            ansQ25c = spdatScoreHelpers.getAnswerFromDb(responseId, Q25c._id, Q25c.dataType);
          } else {
            ansQ25c = spdatScoreHelpers.getAnswer(Q25c._id, Q25c.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ25c} - ${typeof ansQ25c}`);
          const Q26 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /brain issues/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ26;
          if (fromDb) {
            ansQ26 = spdatScoreHelpers.getAnswerFromDb(responseId, Q26._id, Q26.dataType);
          } else {
            ansQ26 = spdatScoreHelpers.getAnswer(Q26._id, Q26.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ26} - ${typeof ansQ26}`);
          if (ansQ25a === 'y' || ansQ25b === 'y' || ansQ25c === 'y' || ansQ26 === 'y' ||
            ansQ25a === 'yes' || ansQ25b === 'yes' || ansQ25c === 'yes' || ansQ26 === 'yes') {
            sectionScores[4].sectionScore += 1;
            tri += 1;
          }
          // TRI-MORBIDITY.
          if (tri === 3) {
            sectionScores[4].sectionScore += 1;
          }
          // MEDICATIONS.
          const Q27 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /not taking/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ27;
          if (fromDb) {
            ansQ27 = spdatScoreHelpers.getAnswerFromDb(responseId, Q27._id, Q27.dataType);
          } else {
            ansQ27 = spdatScoreHelpers.getAnswer(Q27._id, Q27.dataType);   // lowercase 'y'
          }
          logger.log(`27. ${ansQ27} - ${typeof ansQ27}`);
          const Q28 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /like painkillers/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ28;
          if (fromDb) {
            ansQ28 = spdatScoreHelpers.getAnswerFromDb(responseId, Q28._id, Q28.dataType);
          } else {
            ansQ28 = spdatScoreHelpers.getAnswer(Q28._id, Q28.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ28} - ${typeof ansQ28}`);
          if (ansQ27 === 'y' || ansQ28 === 'y' || ansQ27 === 'yes' || ansQ28 === 'yes') {
            sectionScores[4].sectionScore += 1;
          }
        }
      }
    }
    // Score section-wise. Now adding them and returning.
    logger.log(`TAY SCORE Helpers: ${JSON.stringify(sectionScores, null, 2)}`);
    return sectionScores;
  },
  calcSpdatSingleScore(surveyId, responseId = '', fromDb = false) {
    // Get all sections of this survey.
    const surveySections = getSurveySections(surveyId);
    // Initializing the sectionScores as defined in API - Survey Service 1.0.0
    const sectionScores = [];
    for (let i = 0; i < 5; i += 1) {
      const sectionId = '';
      const sectionScore = 0;
      const temp = { sectionId, sectionScore };
      sectionScores.push(temp);
    }
    for (let i = 0; i < surveySections.length; i += 1) {
      // For Basic Information.
      if (sectionScores[0].sectionScore === 0) {
        if (/basic/i.test(surveySections[i].content)) {
          // Fetch all questions from this section which need to be scored.
          sectionScores[0].sectionId = surveySections[i].apiSurveyServiceId;
          const qIds = _.pluck(SurveyQuestionsMaster.find(
            { $and: [
              { sectionID: surveySections[i]._id },
              { surveyID: surveyId },
            ] },
            { fields: { _id: 0, content: 1 } }
          ).fetch(), 'content');
          const Age = Questions.findOne(
            { $and: [
              { _id: { $in: qIds } },
              { question: { $regex: /^age/i } },
            ] }, { fields: { _id: 1, dataType: 1 } }
          );
          // Get their answers from UI and score them according to response
          let ansAge;
          if (fromDb) {
            ansAge = spdatScoreHelpers.getAnswerFromDb(responseId, Age._id, Age.dataType);
            logger.error(`AnsAge: ${ansAge}`);
          } else {
            ansAge = spdatScoreHelpers.getAnswer(Age._id, Age.dataType);
          }
          // Save the value to section Scores.
          if (ansAge >= 60 || parseInt(ansAge, 10) >= 60) {
            sectionScores[0].sectionScore += 1;
          }
        }
      }
      // For Section A: HISTORY OF HOUSING & HOMELESSNESS.
      if (sectionScores[1].sectionScore === 0) {
        if (/homelessness/i.test(surveySections[i].content)) {
          sectionScores[1].sectionId = surveySections[i].apiSurveyServiceId;
          const qIds = _.pluck(SurveyQuestionsMaster.find(
            { $and: [
              { sectionID: surveySections[i]._id },
              { surveyID: surveyId },
            ] },
            { fields: { _id: 0, content: 1 } }
          ).fetch(), 'content');
          // Get all questions and search them accordingly.
          const Q1 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /sleep/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ1;
          if (fromDb) {
            ansQ1 = spdatScoreHelpers.getAnswerFromDb(responseId, Q1._id, Q1.dataType);
          } else {
            ansQ1 = spdatScoreHelpers.getAnswer(Q1._id, Q1.dataType);
          }
          logger.log(`${ansQ1} - ${typeof ansQ1}`);
          if (!(/shelter/.test(ansQ1.toLowerCase())) &&
            !(/safe haven/.test(ansQ1.toLowerCase())) &&
            !(/transitional housing/.test(ansQ1.toLowerCase()))) {
            sectionScores[1].sectionScore += 1;
            logger.log(`Q1: ${Q1._id}`);
          }
          const Q2 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /stable housing/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ2;
          if (fromDb) {
            ansQ2 = spdatScoreHelpers.getAnswerFromDb(responseId, Q2._id, Q2.dataType);
          } else {
            ansQ2 = spdatScoreHelpers.getAnswer(Q2._id, Q2.dataType);
          }
          logger.log(`2. ${ansQ2} - ${typeof ansQ2}`);
          const Q3 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /last three years/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ3;
          if (fromDb) {
            ansQ3 = spdatScoreHelpers.getAnswerFromDb(responseId, Q3._id, Q3.dataType);
          } else {
            ansQ3 = spdatScoreHelpers.getAnswer(Q3._id, Q3.dataType);
          }
          logger.log(`3. ${ansQ3} - ${typeof ansQ3}`);
          if (ansQ2 >= 1 || parseInt(ansQ2, 10) >= 1 || ansQ3 > 4 || parseInt(ansQ3, 10) > 4) {
            logger.log(`Q2, 3: ${ansQ2} ${ansQ2}`);
            sectionScores[1].sectionScore += 1;
          }
        }
      }
      // For Section B: RISKS.
      if (sectionScores[2].sectionScore === 0) {
        if (/risk/i.test(surveySections[i].content)) {
          sectionScores[2].sectionId = surveySections[i].apiSurveyServiceId;
          const qIds = _.pluck(SurveyQuestionsMaster.find(
            { $and: [
              { sectionID: surveySections[i]._id },
              { surveyID: surveyId },
            ] },
            { fields: { _id: 0, content: 1 } }
          ).fetch(), 'content');
          // EMERGENCY SERVICE USE
          const Q4a = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /health care/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ4a;
          if (fromDb) {
            ansQ4a = spdatScoreHelpers.getAnswerFromDb(responseId, Q4a._id, Q4a.dataType);
          } else {
            ansQ4a = spdatScoreHelpers.getAnswer(Q4a._id, Q4a.dataType);
          }
          logger.log(`4. ${ansQ4a} - ${typeof ansQ4a}`);
          const Q4b = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /ambulance/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ4b;
          if (fromDb) {
            ansQ4b = spdatScoreHelpers.getAnswerFromDb(responseId, Q4b._id, Q4b.dataType);
          } else {
            ansQ4b = spdatScoreHelpers.getAnswer(Q4b._id, Q4b.dataType);
          }
          logger.log(`${ansQ4b} - ${typeof ansQ4b}`);
          const Q4c = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /hospitalized/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ4c;
          if (fromDb) {
            ansQ4c = spdatScoreHelpers.getAnswerFromDb(responseId, Q4c._id, Q4c.dataType);
          } else {
            ansQ4c = spdatScoreHelpers.getAnswer(Q4c._id, Q4c.dataType);
          }
          logger.log(`${ansQ4c} - ${typeof ansQ4c}`);
          const Q4d = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /crisis service/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ4d;
          if (fromDb) {
            ansQ4d = spdatScoreHelpers.getAnswerFromDb(responseId, Q4d._id, Q4d.dataType);
          } else {
            ansQ4d = spdatScoreHelpers.getAnswer(Q4d._id, Q4d.dataType);
          }
          logger.log(`${ansQ4d} - ${typeof ansQ4d}`);
          const Q4e = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /police/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ4e;
          if (fromDb) {
            ansQ4e = spdatScoreHelpers.getAnswerFromDb(responseId, Q4e._id, Q4e.dataType);
          } else {
            ansQ4e = spdatScoreHelpers.getAnswer(Q4e._id, Q4e.dataType);
          }
          logger.log(`${ansQ4e} - ${typeof ansQ4e}`);
          const Q4f = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /serious offence/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ4f;
          if (fromDb) {
            ansQ4f = spdatScoreHelpers.getAnswerFromDb(responseId, Q4f._id, Q4f.dataType);
          } else {
            ansQ4f = spdatScoreHelpers.getAnswer(Q4f._id, Q4f.dataType);
          }
          logger.log(`${ansQ4f} - ${typeof ansQ4f}`);
          if ((ansQ4a + ansQ4b + ansQ4c + ansQ4d + ansQ4e + ansQ4f) >= 4) {
            sectionScores[2].sectionScore += 1;
          }
          // RISK OF HARM.
          const Q5 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /beaten up/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ5;
          if (fromDb) {
            ansQ5 = spdatScoreHelpers.getAnswerFromDb(responseId, Q5._id, Q5.dataType);
          } else {
            ansQ5 = spdatScoreHelpers.getAnswer(Q5._id, Q5.dataType);   // lowercase 'y'
          }
          logger.log(`5. ${ansQ5} - ${typeof ansQ5}`);
          const Q6 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /to harm yourself/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ6;
          if (fromDb) {
            ansQ6 = spdatScoreHelpers.getAnswerFromDb(responseId, Q6._id, Q6.dataType);
          } else {
            ansQ6 = spdatScoreHelpers.getAnswer(Q6._id, Q6.dataType);   // lowercase 'y'
          }
          logger.log(`6. ${ansQ6} - ${typeof ansQ6}`);
          if (ansQ5 === 'y' || ansQ6 === 'y' || ansQ5 === 'yes' || ansQ6 === 'yes') {
            sectionScores[2].sectionScore += 1;
          }
          // LEGAL ISSUES.
          const Q7 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /legal stuff/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ7;
          if (fromDb) {
            ansQ7 = spdatScoreHelpers.getAnswerFromDb(responseId, Q7._id, Q7.dataType);
          } else {
            ansQ7 = spdatScoreHelpers.getAnswer(Q7._id, Q7.dataType);   // lowercase 'y'
          }
          logger.log(`7. ${ansQ7} - ${typeof ansQ7}`);
          if (ansQ7 === 'y' || ansQ7 === 'yes') {
            sectionScores[2].sectionScore += 1;
          }
          // RISK OF EXPLOITATION.
          const Q8 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /force or trick/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ8;
          if (fromDb) {
            ansQ8 = spdatScoreHelpers.getAnswerFromDb(responseId, Q8._id, Q8.dataType);
          } else {
            ansQ8 = spdatScoreHelpers.getAnswer(Q8._id, Q8.dataType);   // lowercase 'y'
          }
          logger.log(`8. ${ansQ8} - ${typeof ansQ8}`);
          const Q9 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /sex for money/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ9;
          if (fromDb) {
            ansQ9 = spdatScoreHelpers.getAnswerFromDb(responseId, Q9._id, Q9.dataType);
          } else {
            ansQ9 = spdatScoreHelpers.getAnswer(Q9._id, Q9.dataType);   // lowercase 'y'
          }
          logger.log(`9. ${ansQ9} - ${typeof ansQ9}`);
          if (ansQ8 === 'y' || ansQ9 === 'y' || ansQ8 === 'yes' || ansQ9 === 'yes') {
            sectionScores[2].sectionScore += 1;
          }
        }
      }
      // For Section C: SOCIALIZATION & DAILY FUNCTIONS.
      if (sectionScores[3].sectionScore === 0) {
        if (/socialization/i.test(surveySections[i].content)) {
          sectionScores[3].sectionId = surveySections[i].apiSurveyServiceId;
          const qIds = _.pluck(SurveyQuestionsMaster.find(
            { $and: [
              { sectionID: surveySections[i]._id },
              { surveyID: surveyId },
            ] },
            { fields: { _id: 0, content: 1 } }
          ).fetch(), 'content');
          // MONEY MANAGEMENT.
          const Q10 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /past landlord/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ10;
          if (fromDb) {
            ansQ10 = spdatScoreHelpers.getAnswerFromDb(responseId, Q10._id, Q10.dataType);
          } else {
            ansQ10 = spdatScoreHelpers.getAnswer(Q10._id, Q10.dataType);   // lowercase 'y'
          }
          logger.log(`10. ${ansQ10} - ${typeof ansQ10}`);
          const Q11 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /from the government/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ11;
          if (fromDb) {
            ansQ11 = spdatScoreHelpers.getAnswerFromDb(responseId, Q11._id, Q11.dataType);
          } else {
            ansQ11 = spdatScoreHelpers.getAnswer(Q11._id, Q11.dataType);   // lowercase 'y'
          }
          logger.log(`11. ${ansQ11} - ${typeof ansQ11}`);
          if (ansQ10 === 'y' || ansQ11 === 'n' || ansQ10 === 'yes' || ansQ11 === 'no') {
            sectionScores[3].sectionScore += 1;
          }
          // MEANINGFUL DAILY ACTIVITY.
          const Q12 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /planned activities/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ12;
          if (fromDb) {
            ansQ12 = spdatScoreHelpers.getAnswerFromDb(responseId, Q12._id, Q12.dataType);
          } else {
            ansQ12 = spdatScoreHelpers.getAnswer(Q12._id, Q12.dataType);   // lowercase 'y'
          }
          logger.log(`12. ${ansQ12} - ${typeof ansQ12}`);
          if (ansQ12 === 'n' || ansQ12 === 'no') {
            sectionScores[3].sectionScore += 1;
          }
          // SELF-CARE.
          const Q13 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /care of basic needs/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ13;
          if (fromDb) {
            ansQ13 = spdatScoreHelpers.getAnswerFromDb(responseId, Q13._id, Q13.dataType);
          } else {
            ansQ13 = spdatScoreHelpers.getAnswer(Q13._id, Q13.dataType);   // lowercase 'y'
          }
          logger.log(`13. ${ansQ13} - ${typeof ansQ13}`);
          if (ansQ13 === 'n' || ansQ13 === 'no') {
            sectionScores[3].sectionScore += 1;
          }
          // SOCIAL RELATIONSHIPS.
          const Q14 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /abusive relationship/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ14;
          if (fromDb) {
            ansQ14 = spdatScoreHelpers.getAnswerFromDb(responseId, Q14._id, Q14.dataType);
          } else {
            ansQ14 = spdatScoreHelpers.getAnswer(Q14._id, Q14.dataType);   // lowercase 'y'
          }
          logger.log(`14. ${ansQ14} - ${typeof ansQ14}`);
          if (ansQ14 === 'y' || ansQ14 === 'yes') {
            sectionScores[3].sectionScore += 1;
          }
        }
      }
      // For Section D: WELLNESS.
      if (sectionScores[4].sectionScore === 0) {
        if (/wellness/i.test(surveySections[i].content)) {
          sectionScores[4].sectionId = surveySections[i].apiSurveyServiceId;
          const qIds = _.pluck(SurveyQuestionsMaster.find(
            { $and: [
              { sectionID: surveySections[i]._id },
              { surveyID: surveyId },
            ] },
            { fields: { _id: 0, content: 1 } }
          ).fetch(), 'content');
          let tri = 0;      // for Tri-Morbidity.
          // PHYSICAL HEALTH.
          const Q15 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /leave an apartment/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ15;
          if (fromDb) {
            ansQ15 = spdatScoreHelpers.getAnswerFromDb(responseId, Q15._id, Q15.dataType);
          } else {
            ansQ15 = spdatScoreHelpers.getAnswer(Q15._id, Q15.dataType);   // lowercase 'y'
          }
          logger.log(`15. ${ansQ15} - ${typeof ansQ15}`);
          const Q16 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /chronic health issues/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ16;
          if (fromDb) {
            ansQ16 = spdatScoreHelpers.getAnswerFromDb(responseId, Q16._id, Q16.dataType);
          } else {
            ansQ16 = spdatScoreHelpers.getAnswer(Q16._id, Q16.dataType);   // lowercase 'y'
          }
          logger.log(`16. ${ansQ16} - ${typeof ansQ16}`);
          const Q17 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /HIV or AIDS/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ17;
          if (fromDb) {
            ansQ17 = spdatScoreHelpers.getAnswerFromDb(responseId, Q17._id, Q17.dataType);
          } else {
            ansQ17 = spdatScoreHelpers.getAnswer(Q17._id, Q17.dataType);   // lowercase 'y'
          }
          logger.log(`17. ${ansQ17} - ${typeof ansQ17}`);
          const Q18 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /physical disabilities/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ18;
          if (fromDb) {
            ansQ18 = spdatScoreHelpers.getAnswerFromDb(responseId, Q18._id, Q18.dataType);
          } else {
            ansQ18 = spdatScoreHelpers.getAnswer(Q18._id, Q18.dataType);   // lowercase 'y'
          }
          logger.log(`18. ${ansQ18} - ${typeof ansQ18}`);
          const Q19 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /avoid getting help/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ19;
          if (fromDb) {
            ansQ19 = spdatScoreHelpers.getAnswerFromDb(responseId, Q19._id, Q19.dataType);
          } else {
            ansQ19 = spdatScoreHelpers.getAnswer(Q19._id, Q19.dataType);   // lowercase 'y'
          }
          logger.log(`19. ${ansQ19} - ${typeof ansQ19}`);
          const Q20 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /pregnant/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ20;
          if (fromDb) {
            ansQ20 = spdatScoreHelpers.getAnswerFromDb(responseId, Q20._id, Q20.dataType);
          } else {
            ansQ20 = spdatScoreHelpers.getAnswer(Q20._id, Q20.dataType);   // lowercase 'y'
          }
          logger.log(`20. ${ansQ20} - ${typeof ansQ20}`);
          if (ansQ15 === 'y' || ansQ16 === 'y' || ansQ17 === 'y' || ansQ18 === 'y' ||
            ansQ19 === 'y' || ansQ20 === 'y' || ansQ15 === 'yes' || ansQ16 === 'yes' ||
            ansQ17 === 'yes' || ansQ18 === 'yes' || ansQ19 === 'yes' || ansQ20 === 'yes') {
            sectionScores[4].sectionScore += 1;
            tri += 1;
          }
          // SUBSTANCE USE.
          const Q21 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /staying in the past/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ21;
          if (fromDb) {
            ansQ21 = spdatScoreHelpers.getAnswerFromDb(responseId, Q21._id, Q21.dataType);
          } else {
            ansQ21 = spdatScoreHelpers.getAnswer(Q21._id, Q21.dataType);   // lowercase 'y'
          }
          logger.log(`21. ${ansQ21} - ${typeof ansQ21}`);
          const Q22 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /afford your housing/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ22;
          if (fromDb) {
            ansQ22 = spdatScoreHelpers.getAnswerFromDb(responseId, Q22._id, Q22.dataType);
          } else {
            ansQ22 = spdatScoreHelpers.getAnswer(Q22._id, Q22.dataType);   // lowercase 'y'
          }
          logger.log(`22. ${ansQ22} - ${typeof ansQ22}`);
          if (ansQ21 === 'y' || ansQ22 === 'y' ||
            ansQ21 === 'yes' || ansQ22 === 'yes') {
            sectionScores[4].sectionScore += 1;
            tri += 1;
          }
          // MENTAL HEALTH.
          const Q23a = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /mental health issue/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ23a;
          if (fromDb) {
            ansQ23a = spdatScoreHelpers.getAnswerFromDb(responseId, Q23a._id, Q23a.dataType);
          } else {
            ansQ23a = spdatScoreHelpers.getAnswer(Q23a._id, Q23a.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ23a} - ${typeof ansQ23a}`);
          const Q23b = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /past head injury/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ23b;
          if (fromDb) {
            ansQ23b = spdatScoreHelpers.getAnswerFromDb(responseId, Q23b._id, Q23b.dataType);
          } else {
            ansQ23b = spdatScoreHelpers.getAnswer(Q23b._id, Q23b.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ23b} - ${typeof ansQ23b}`);
          const Q23c = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: / learning disability/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ23c;
          if (fromDb) {
            ansQ23c = spdatScoreHelpers.getAnswerFromDb(responseId, Q23c._id, Q23c.dataType);
          } else {
            ansQ23c = spdatScoreHelpers.getAnswer(Q23c._id, Q23c.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ23c} - ${typeof ansQ23c}`);
          const Q24 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /brain issues/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ24;
          if (fromDb) {
            ansQ24 = spdatScoreHelpers.getAnswerFromDb(responseId, Q24._id, Q24.dataType);
          } else {
            ansQ24 = spdatScoreHelpers.getAnswer(Q24._id, Q24.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ24} - ${typeof ansQ24}`);
          if (ansQ23a === 'y' || ansQ23b === 'y' || ansQ23c === 'y' || ansQ24 === 'y' ||
            ansQ23a === 'yes' || ansQ23b === 'yes' || ansQ23c === 'yes' || ansQ24 === 'yes') {
            sectionScores[4].sectionScore += 1;
            tri += 1;
          }
          // TRI-MORBIDITY.
          if (tri === 3) {
            sectionScores[4].sectionScore += 1;
          }
          // MEDICATIONS.
          const Q25 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /not taking/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ25;
          if (fromDb) {
            ansQ25 = spdatScoreHelpers.getAnswerFromDb(responseId, Q25._id, Q25.dataType);
          } else {
            ansQ25 = spdatScoreHelpers.getAnswer(Q25._id, Q25.dataType);   // lowercase 'y'
          }
          logger.log(`25. ${ansQ25} - ${typeof ansQ25}`);
          const Q26 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /like painkillers/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ26;
          if (fromDb) {
            ansQ26 = spdatScoreHelpers.getAnswerFromDb(responseId, Q26._id, Q26.dataType);
          } else {
            ansQ26 = spdatScoreHelpers.getAnswer(Q26._id, Q26.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ26} - ${typeof ansQ26}`);
          if (ansQ25 === 'y' || ansQ26 === 'y' || ansQ25 === 'yes' || ansQ26 === 'yes') {
            sectionScores[4].sectionScore += 1;
          }
          // ABUSE and TRAUMA.
          const Q27 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /type of abuse/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ27;
          if (fromDb) {
            ansQ27 = spdatScoreHelpers.getAnswerFromDb(responseId, Q27._id, Q27.dataType);
          } else {
            ansQ27 = spdatScoreHelpers.getAnswer(Q27._id, Q27.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ27} - ${typeof ansQ27}`);
          if (ansQ27 === 'y' || ansQ27 === 'yes') {
            sectionScores[4].sectionScore += 1;
          }
        }
      }
    }
    // Score section-wise. Now adding them and returning.
    logger.log(`${JSON.stringify(sectionScores)}`);
    return sectionScores;
  },
  calcSpdatFamilyScore(surveyId, responseId = '', fromDb = false) {
    // Get all sections of this survey.
    let schoolChild = false;
    let flagForQ41 = false;
    let singleParent = true;
    let youngerThan6 = false;
    let youngerThan11 = false;
    const surveySections = getSurveySections(surveyId);
    // Initializing the sectionScores as defined in API - Survey Service 1.0.0
    const sectionScores = [];
    for (let i = 0; i < 6; i += 1) {
      const sectionId = '';
      const sectionScore = 0;
      const temp = { sectionId, sectionScore };
      sectionScores.push(temp);
    }
    for (let i = 0; i < surveySections.length; i += 1) {
      // For Basic Information - Parent 1.
      if (/parent 1/i.test(surveySections[i].content)) {
        // Fetch all questions from this section which need to be scored.
        sectionScores[0].sectionId = surveySections[i].apiSurveyServiceId;
        const qIds = _.pluck(SurveyQuestionsMaster.find(
          { $and: [
            { sectionID: surveySections[i]._id },
            { surveyID: surveyId },
          ] },
          { fields: { _id: 0, content: 1 } }
        ).fetch(), 'content');
        const Age1 = Questions.findOne(
          { $and: [
            { _id: { $in: qIds } },
            { question: { $regex: /^age/i } },
          ] }, { fields: { _id: 1, dataType: 1 } }
        );
        // Get their answers from UI and score them according to response
        let ansAge1;
        if (fromDb) {
          ansAge1 = spdatScoreHelpers.getAnswerFromDb(responseId, Age1._id, Age1.dataType);
        } else {
          ansAge1 = spdatScoreHelpers.getAnswer(Age1._id, Age1.dataType);
        }
        // Save the value to section Scores.
        if (ansAge1 >= 60 || parseInt(ansAge1, 10) >= 60) {
          if (sectionScores[0].sectionScore !== 1) {
            sectionScores[0].sectionScore += 1;
          }
        }
          // if details of other parent is available. Checking that also here.
      }
      // For Basic Information - Parent 2.
      if (/parent 2/i.test(surveySections[i].content)) {
        // Fetch all questions from this section which need to be scored.
        sectionScores[0].sectionId = surveySections[i].apiSurveyServiceId;
        const qIds = _.pluck(SurveyQuestionsMaster.find(
          {
            $and: [
              { sectionID: surveySections[i]._id },
              { surveyID: surveyId },
            ],
          },
          { fields: { _id: 0, content: 1 } }
        ).fetch(), 'content');
        const Age2 = Questions.findOne(
          {
            $and: [
              { _id: { $in: qIds } },
              { question: { $regex: /^age/i } },
            ],
          },
        { fields: { _id: 1, dataType: 1 } }
        );
        // Get their answers from UI and score them according to response
        let ansAge2;
        if (fromDb) {
          ansAge2 = spdatScoreHelpers.getAnswerFromDb(responseId, Age2._id, Age2.dataType);
        } else {
          ansAge2 = spdatScoreHelpers.getAnswer(Age2._id, Age2.dataType);
        }
        // Save the value to section Scores.
        if (ansAge2 >= 60 || parseInt(ansAge2, 10) >= 60) {
          if (sectionScores[0].sectionScore !== 1) {
            sectionScores[0].sectionScore += 1;
            singleParent = false;
          }
        }
      }
      // Implement for Children Section.
      // Update variables schoolChild and flagForQ41 here.
      // For Section: Children.
      if (/children/i.test(surveySections[i].content)) {
        // Fetch all questions from this section which need to be scored.
        const qIds = _.pluck(SurveyQuestionsMaster.find(
          { $and: [
            { sectionID: surveySections[i]._id },
            { surveyID: surveyId },
          ] },
          { fields: { _id: 0, content: 1 } }
        ).fetch(), 'content');
        const Q1 = Questions.findOne(
          { $and: [{ _id: { $in: qIds } }, { question: { $regex: /are currently with you/i } }] },
          { fields: { _id: 1, dataType: 1 } }
        );
        let ansQ1;
        if (fromDb) {
          ansQ1 = spdatScoreHelpers.getAnswerFromDb(responseId, Q1._id, Q1.dataType);
        } else {
          ansQ1 = spdatScoreHelpers.getAnswer(Q1._id, Q1.dataType);
        }
        logger.log(`1. ${ansQ1} - ${typeof ansQ1}`);
        const Q2 = Questions.findOne(
          { $and: [{ _id: { $in: qIds } }, { question: { $regex: /not currently with you/i } }] },
          { fields: { _id: 1, dataType: 1 } }
        );
        let ansQ2;
        if (fromDb) {
          ansQ2 = spdatScoreHelpers.getAnswerFromDb(responseId, Q2._id, Q2.dataType);
        } else {
          ansQ2 = spdatScoreHelpers.getAnswer(Q2._id, Q2.dataType);
        }
        logger.log(`2. ${ansQ2} - ${typeof ansQ2}`);
        const Q3 = Questions.findOne(
          { $and: [{ _id: { $in: qIds } }, { question: { $regex: /pregnant/i } }] },
          { fields: { _id: 1, dataType: 1 } }
        );
        let ansQ3;
        if (fromDb) {
          ansQ3 = spdatScoreHelpers.getAnswerFromDb(responseId, Q3._id, Q3.dataType);
        } else {
          ansQ3 = spdatScoreHelpers.getAnswer(Q3._id, Q3.dataType);
        }
        logger.log(`3. ${ansQ3} - ${typeof ansQ3}`);
        const Q4 = Questions.findOne(
          { $and: [{ _id: { $in: qIds } }, { question: { $regex: /names/i } }] },
          { fields: { _id: 1, dataType: 1 } }
        );
        let ansQ4;
        if (fromDb) {
          ansQ4 = spdatScoreHelpers.getAnswerFromDb(responseId, Q4._id, Q4.dataType);
        } else {
          ansQ4 = spdatScoreHelpers.getAnswer(Q4._id, Q4.dataType);
        }
        const children = ansQ4.split('|');
        let under12 = false;
        let over13 = false;
        for (let p = 0; p < children.length; p += 1) {
          const temp = children[p].split(',');
          if (parseInt(temp[1], 10) <= 12) {
            under12 = true;
          } else {
            over13 = true;
          }
          if (parseInt(temp[1], 10) <= 6) {
            youngerThan11 = true; youngerThan6 = true;
          } else if (parseInt(temp[1], 10) <= 11) {
            youngerThan11 = true;
          }
        }
        logger.log(`4. ${ansQ4} - ${typeof ansQ4}`);
        // Updating flag for Q36.
        if ((ansQ1 + ansQ2) > 0) {
          schoolChild = true;
        }
        // Updating flag for Q41.
        if (under12 && over13) {
          flagForQ41 = true;
        }
        // Save the value to section Scores.
        if ((singleParent && (ansQ1 + ansQ2) > 2) || ansQ3 === 'y' || ansQ3 === 'yes'
          || youngerThan11) {
          sectionScores[0].sectionScore += 1;
        } else if ((!singleParent && (ansQ1 + ansQ2) > 3) || ansQ3 === 'y' || ansQ3 === 'yes'
          || youngerThan6) {
          sectionScores[0].sectionScore += 1;
        }
      }
      // For Section A: HISTORY OF HOUSING & HOMELESSNESS.
      if (sectionScores[1].sectionScore === 0) {
        if (/homelessness/i.test(surveySections[i].content)) {
          sectionScores[1].sectionId = surveySections[i].apiSurveyServiceId;
          const qIds = _.pluck(SurveyQuestionsMaster.find(
            { $and: [
              { sectionID: surveySections[i]._id },
              { surveyID: surveyId },
            ] },
            { fields: { _id: 0, content: 1 } }
          ).fetch(), 'content');
          // Get all questions and search them accordingly.
          const Q5 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /sleep/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ5;
          if (fromDb) {
            ansQ5 = spdatScoreHelpers.getAnswerFromDb(responseId, Q5._id, Q5.dataType);
          } else {
            ansQ5 = spdatScoreHelpers.getAnswer(Q5._id, Q5.dataType);
          }
          logger.log(`${ansQ5} - ${typeof ansQ5}`);
          if (!(/shelter/.test(ansQ5.toLowerCase())) &&
            !(/safe haven/.test(ansQ5.toLowerCase())) &&
            !(/transitional housing/.test(ansQ5.toLowerCase()))) {
            sectionScores[1].sectionScore += 1;
            logger.log(`Q5: ${Q5._id}`);
          }
          const Q6 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /stable housing/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ6;
          if (fromDb) {
            ansQ6 = spdatScoreHelpers.getAnswerFromDb(responseId, Q6._id, Q6.dataType);
          } else {
            ansQ6 = spdatScoreHelpers.getAnswer(Q6._id, Q6.dataType);
          }
          logger.log(`6. ${ansQ6} - ${typeof ansQ6}`);
          const Q7 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /last three years/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ7;
          if (fromDb) {
            ansQ7 = spdatScoreHelpers.getAnswerFromDb(responseId, Q7._id, Q7.dataType);
          } else {
            ansQ7 = spdatScoreHelpers.getAnswer(Q7._id, Q7.dataType);
          }
          logger.log(`7. ${ansQ7} - ${typeof ansQ7}`);
          if (ansQ6 >= 1 || parseInt(ansQ6, 10) >= 1 || ansQ7 > 4 || parseInt(ansQ7, 10) > 4) {
            sectionScores[1].sectionScore += 1;
          }
        }
      }
      // For Section B: RISKS.
      if (sectionScores[2].sectionScore === 0) {
        if (/risk/i.test(surveySections[i].content)) {
          sectionScores[2].sectionId = surveySections[i].apiSurveyServiceId;
          const qIds = _.pluck(SurveyQuestionsMaster.find(
            { $and: [
              { sectionID: surveySections[i]._id },
              { surveyID: surveyId },
            ] },
            { fields: { _id: 0, content: 1 } }
          ).fetch(), 'content');
          // EMERGENCY SERVICE USE
          const Q8a = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /health care/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ8a;
          if (fromDb) {
            ansQ8a = spdatScoreHelpers.getAnswerFromDb(responseId, Q8a._id, Q8a.dataType);
          } else {
            ansQ8a = spdatScoreHelpers.getAnswer(Q8a._id, Q8a.dataType);
          }
          logger.log(`4. ${ansQ8a} - ${typeof ansQ8a}`);
          const Q8b = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /ambulance/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ8b;
          if (fromDb) {
            ansQ8b = spdatScoreHelpers.getAnswerFromDb(responseId, Q8b._id, Q8b.dataType);
          } else {
            ansQ8b = spdatScoreHelpers.getAnswer(Q8a._id, Q8b.dataType);
          }
          logger.log(`${ansQ8b} - ${typeof ansQ8b}`);
          const Q8c = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /hospitalized/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ8c;
          if (fromDb) {
            ansQ8c = spdatScoreHelpers.getAnswerFromDb(responseId, Q8c._id, Q8c.dataType);
          } else {
            ansQ8c = spdatScoreHelpers.getAnswer(Q8c._id, Q8c.dataType);
          }
          logger.log(`${ansQ8c} - ${typeof ansQ8c}`);
          const Q8d = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /crisis service/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ8d;
          if (fromDb) {
            ansQ8d = spdatScoreHelpers.getAnswerFromDb(responseId, Q8d._id, Q8d.dataType);
          } else {
            ansQ8d = spdatScoreHelpers.getAnswer(Q8d._id, Q8d.dataType);
          }
          logger.log(`${ansQ8d} - ${typeof ansQ8d}`);
          const Q8e = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /police/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ8e;
          if (fromDb) {
            ansQ8e = spdatScoreHelpers.getAnswerFromDb(responseId, Q8e._id, Q8e.dataType);
          } else {
            ansQ8e = spdatScoreHelpers.getAnswer(Q8e._id, Q8e.dataType);
          }
          logger.log(`${ansQ8e} - ${typeof ansQ8e}`);
          const Q8f = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /serious offence/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ8f;
          if (fromDb) {
            ansQ8f = spdatScoreHelpers.getAnswerFromDb(responseId, Q8f._id, Q8f.dataType);
          } else {
            ansQ8f = spdatScoreHelpers.getAnswer(Q8f._id, Q8f.dataType);
          }
          logger.log(`${ansQ8f} - ${typeof ansQ8f}`);
          if ((ansQ8a + ansQ8b + ansQ8c + ansQ8d + ansQ8e + ansQ8f) >= 4) {
            sectionScores[2].sectionScore += 1;
          }
          // RISK OF HARM.
          const Q9 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /beaten up/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ9;
          if (fromDb) {
            ansQ9 = spdatScoreHelpers.getAnswerFromDb(responseId, Q9._id, Q9.dataType);
          } else {
            ansQ9 = spdatScoreHelpers.getAnswer(Q9._id, Q9.dataType);   // lowercase 'y'
          }
          logger.log(`9. ${ansQ9} - ${typeof ansQ9}`);
          const Q10 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /tried to harm/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ10;
          if (fromDb) {
            ansQ10 = spdatScoreHelpers.getAnswerFromDb(responseId, Q10._id, Q10.dataType);
          } else {
            ansQ10 = spdatScoreHelpers.getAnswer(Q10._id, Q10.dataType);   // lowercase 'y'
          }
          logger.log(`6. ${ansQ10} - ${typeof ansQ10}`);
          if (ansQ9 === 'y' || ansQ10 === 'y' || ansQ9 === 'yes' || ansQ10 === 'yes') {
            sectionScores[2].sectionScore += 1;
          }
          // LEGAL ISSUES.
          const Q11 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /legal stuff/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ11;
          if (fromDb) {
            ansQ11 = spdatScoreHelpers.getAnswerFromDb(responseId, Q11._id, Q11.dataType);
          } else {
            ansQ11 = spdatScoreHelpers.getAnswer(Q11._id, Q11.dataType);   // lowercase 'y'
          }
          logger.log(`7. ${ansQ11} - ${typeof ansQ11}`);
          if (ansQ11 === 'y' || ansQ11 === 'yes') {
            sectionScores[2].sectionScore += 1;
          }
          // RISK OF EXPLOITATION.
          const Q12 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /force or trick/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ12;
          if (fromDb) {
            ansQ12 = spdatScoreHelpers.getAnswerFromDb(responseId, Q12._id, Q12.dataType);
          } else {
            ansQ12 = spdatScoreHelpers.getAnswer(Q12._id, Q12.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ12} - ${typeof ansQ12}`);
          const Q13 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /sex for money/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ13;
          if (fromDb) {
            ansQ13 = spdatScoreHelpers.getAnswerFromDb(responseId, Q13._id, Q13.dataType);
          } else {
            ansQ13 = spdatScoreHelpers.getAnswer(Q13._id, Q13.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ13} - ${typeof ansQ13}`);
          if (ansQ12 === 'y' || ansQ13 === 'y' || ansQ12 === 'yes' || ansQ13 === 'yes') {
            sectionScores[2].sectionScore += 1;
          }
        }
      }
      // For Section C: SOCIALIZATION & DAILY FUNCTIONS.
      if (sectionScores[3].sectionScore === 0) {
        if (/socialization/i.test(surveySections[i].content)) {
          sectionScores[3].sectionId = surveySections[i].apiSurveyServiceId;
          const qIds = _.pluck(SurveyQuestionsMaster.find(
            { $and: [
              { sectionID: surveySections[i]._id },
              { surveyID: surveyId },
            ] },
            { fields: { _id: 0, content: 1 } }
          ).fetch(), 'content');
          // MONEY MANAGEMENT.
          const Q14 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /past landlord/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ14;
          if (fromDb) {
            ansQ14 = spdatScoreHelpers.getAnswerFromDb(responseId, Q14._id, Q14.dataType);
          } else {
            ansQ14 = spdatScoreHelpers.getAnswer(Q14._id, Q14.dataType);   // lowercase 'y'
          }
          logger.log(`14. ${ansQ14} - ${typeof ansQ14}`);
          const Q15 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /from the government/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ15;
          if (fromDb) {
            ansQ15 = spdatScoreHelpers.getAnswerFromDb(responseId, Q15._id, Q15.dataType);
          } else {
            ansQ15 = spdatScoreHelpers.getAnswer(Q15._id, Q15.dataType);   // lowercase 'y'
          }
          logger.log(`15. ${ansQ15} - ${typeof ansQ15}`);
          if (ansQ14 === 'y' || ansQ15 === 'n' || ansQ14 === 'yes' || ansQ15 === 'no') {
            sectionScores[3].sectionScore += 1;
          }
          // MEANINGFUL DAILY ACTIVITY.
          const Q16 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /planned activities/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ16;
          if (fromDb) {
            ansQ16 = spdatScoreHelpers.getAnswerFromDb(responseId, Q16._id, Q16.dataType);
          } else {
            ansQ16 = spdatScoreHelpers.getAnswer(Q16._id, Q16.dataType);   // lowercase 'y'
          }
          logger.log(`16. ${ansQ16} - ${typeof ansQ16}`);
          if (ansQ16 === 'n' || ansQ16 === 'no') {
            sectionScores[3].sectionScore += 1;
          }
          // SELF-CARE.
          const Q17 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /care of basic needs/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ17;
          if (fromDb) {
            ansQ17 = spdatScoreHelpers.getAnswerFromDb(responseId, Q17._id, Q17.dataType);
          } else {
            ansQ17 = spdatScoreHelpers.getAnswer(Q17._id, Q17.dataType);   // lowercase 'y'
          }
          logger.log(`17. ${ansQ17} - ${typeof ansQ17}`);
          if (ansQ17 === 'n' || ansQ17 === 'no') {
            sectionScores[3].sectionScore += 1;
          }
          // SOCIAL RELATIONSHIPS.
          const Q18 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /abusive relationship/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ18;
          if (fromDb) {
            ansQ18 = spdatScoreHelpers.getAnswerFromDb(responseId, Q18._id, Q18.dataType);
          } else {
            ansQ18 = spdatScoreHelpers.getAnswer(Q18._id, Q18.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ18} - ${typeof ansQ18}`);
          if (ansQ18 === 'y' || ansQ18 === 'yes') {
            sectionScores[3].sectionScore += 1;
          }
        }
      }
      // For Section D: WELLNESS.
      if (sectionScores[4].sectionScore === 0) {
        if (/wellness/i.test(surveySections[i].content)) {
          sectionScores[4].sectionId = surveySections[i].apiSurveyServiceId;
          const qIds = _.pluck(SurveyQuestionsMaster.find(
            { $and: [
              { sectionID: surveySections[i]._id },
              { surveyID: surveyId },
            ] },
            { fields: { _id: 0, content: 1 } }
          ).fetch(), 'content');
          let tri = 0;      // for Tri-Morbidity.
          // PHYSICAL HEALTH.
          const Q19 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /leave an apartment/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ19;
          if (fromDb) {
            ansQ19 = spdatScoreHelpers.getAnswerFromDb(responseId, Q19._id, Q19.dataType);
          } else {
            ansQ19 = spdatScoreHelpers.getAnswer(Q19._id, Q19.dataType);   // lowercase 'y'
          }
          logger.log(`19. ${ansQ19} - ${typeof ansQ19}`);
          const Q20 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /chronic health issues/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ20;
          if (fromDb) {
            ansQ20 = spdatScoreHelpers.getAnswerFromDb(responseId, Q20._id, Q20.dataType);
          } else {
            ansQ20 = spdatScoreHelpers.getAnswer(Q20._id, Q20.dataType);   // lowercase 'y'
          }
          logger.log(`20. ${ansQ20} - ${typeof ansQ20}`);
          const Q21 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /HIV or AIDS/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ21;
          if (fromDb) {
            ansQ21 = spdatScoreHelpers.getAnswerFromDb(responseId, Q21._id, Q21.dataType);
          } else {
            ansQ21 = spdatScoreHelpers.getAnswer(Q21._id, Q21.dataType);   // lowercase 'y'
          }
          logger.log(`21. ${ansQ21} - ${typeof ansQ21}`);
          const Q22 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /physical disabilities/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ22;
          if (fromDb) {
            ansQ22 = spdatScoreHelpers.getAnswerFromDb(responseId, Q22._id, Q22.dataType);
          } else {
            ansQ22 = spdatScoreHelpers.getAnswer(Q22._id, Q22.dataType);   // lowercase 'y'
          }
          logger.log(`22. ${ansQ22} - ${typeof ansQ22}`);
          const Q23 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /avoid getting medical/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ23;
          if (fromDb) {
            ansQ23 = spdatScoreHelpers.getAnswerFromDb(responseId, Q23._id, Q23.dataType);
          } else {
            ansQ23 = spdatScoreHelpers.getAnswer(Q23._id, Q23.dataType);   // lowercase 'y'
          }
          logger.log(`23. ${ansQ23} - ${typeof ansQ23}`);
          if (ansQ19 === 'y' || ansQ20 === 'y' || ansQ21 === 'y' || ansQ22 === 'y' ||
            ansQ23 === 'y' || ansQ19 === 'yes' || ansQ20 === 'yes' || ansQ21 === 'yes' ||
            ansQ22 === 'yes' || ansQ23 === 'yes') {
            sectionScores[4].sectionScore += 1;
            tri += 1;
          }
          // SUBSTANCE USE.
          const Q24 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /staying in the past/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ24;
          if (fromDb) {
            ansQ24 = spdatScoreHelpers.getAnswerFromDb(responseId, Q24._id, Q24.dataType);
          } else {
            ansQ24 = spdatScoreHelpers.getAnswer(Q24._id, Q24.dataType);   // lowercase 'y'
          }
          logger.log(`24. ${ansQ24} - ${typeof ansQ24}`);
          const Q25 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /afford your housing/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ25;
          if (fromDb) {
            ansQ25 = spdatScoreHelpers.getAnswerFromDb(responseId, Q25._id, Q25.dataType);
          } else {
            ansQ25 = spdatScoreHelpers.getAnswer(Q25._id, Q25.dataType);   // lowercase 'y'
          }
          logger.log(`25. ${ansQ25} - ${typeof ansQ25}`);
          if (ansQ24 === 'y' || ansQ25 === 'y' ||
            ansQ24 === 'yes' || ansQ25 === 'yes') {
            sectionScores[4].sectionScore += 1;
            tri += 1;
          }
          // MENTAL HEALTH.
          const Q26a = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /mental health issue/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ26a;
          if (fromDb) {
            ansQ26a = spdatScoreHelpers.getAnswerFromDb(responseId, Q26a._id, Q26a.dataType);
          } else {
            ansQ26a = spdatScoreHelpers.getAnswer(Q26a._id, Q26a.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ26a} - ${typeof ansQ26a}`);
          const Q26b = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /past head injury/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ26b;
          if (fromDb) {
            ansQ26b = spdatScoreHelpers.getAnswerFromDb(responseId, Q26b._id, Q26b.dataType);
          } else {
            ansQ26b = spdatScoreHelpers.getAnswer(Q26b._id, Q26b.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ26b} - ${typeof ansQ26b}`);
          const Q26c = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: / learning disability/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ26c;
          if (fromDb) {
            ansQ26c = spdatScoreHelpers.getAnswerFromDb(responseId, Q26c._id, Q26c.dataType);
          } else {
            ansQ26c = spdatScoreHelpers.getAnswer(Q26c._id, Q26c.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ26c} - ${typeof ansQ26c}`);
          const Q27 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /brain issues/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ27;
          if (fromDb) {
            ansQ27 = spdatScoreHelpers.getAnswerFromDb(responseId, Q27._id, Q27.dataType);
          } else {
            ansQ27 = spdatScoreHelpers.getAnswer(Q27._id, Q27.dataType);   // lowercase 'y'
          }
          logger.log(`27. ${ansQ27} - ${typeof ansQ27}`);
          if (ansQ26a === 'y' || ansQ26b === 'y' || ansQ26c === 'y' || ansQ27 === 'y' ||
            ansQ26a === 'yes' || ansQ26b === 'yes' || ansQ26c === 'yes' || ansQ27 === 'yes') {
            sectionScores[4].sectionScore += 1;
            tri += 1;
          }
          // TRI-MORBIDITY.
          if (tri === 3) {
            const Q28 = Questions.findOne(
              { $and: [{ _id: { $in: qIds } }, { question: { $regex: /medical condition/i } }] },
              { fields: { _id: 1, dataType: 1 } }
            );
            let ansQ28;
            if (fromDb) {
              ansQ28 = spdatScoreHelpers.getAnswerFromDb(responseId, Q28._id, Q28.dataType);
            } else {
              ansQ28 = spdatScoreHelpers.getAnswer(Q28._id, Q28.dataType);   // lowercase 'y'
            }
            logger.log(`${ansQ28} - ${typeof ansQ28}`);
            if (ansQ28 === 'y' || ansQ28 === 'yes') {
              sectionScores[4].sectionScore += 1;
            }
          }
          // MEDICATIONS.
          const Q29 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /not taking/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ29;
          if (fromDb) {
            ansQ29 = spdatScoreHelpers.getAnswerFromDb(responseId, Q29._id, Q29.dataType);
          } else {
            ansQ29 = spdatScoreHelpers.getAnswer(Q29._id, Q29.dataType);   // lowercase 'y'
          }
          logger.log(`29. ${ansQ29} - ${typeof ansQ29}`);
          const Q30 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /like painkillers/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ30;
          if (fromDb) {
            ansQ30 = spdatScoreHelpers.getAnswerFromDb(responseId, Q30._id, Q30.dataType);
          } else {
            ansQ30 = spdatScoreHelpers.getAnswer(Q30._id, Q30.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ30} - ${typeof ansQ30}`);
          if (ansQ29 === 'y' || ansQ30 === 'y' || ansQ29 === 'yes' || ansQ30 === 'yes') {
            sectionScores[4].sectionScore += 1;
          }
          // ABUSE and TRAUMA.
          const Q31 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /other type of abuse/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ31;
          if (fromDb) {
            ansQ31 = spdatScoreHelpers.getAnswerFromDb(responseId, Q31._id, Q31.dataType);
          } else {
            ansQ31 = spdatScoreHelpers.getAnswer(Q31._id, Q31.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ31} - ${typeof ansQ31}`);
          if (ansQ31 === 'y' || ansQ31 === 'yes') {
            sectionScores[4].sectionScore += 1;
          }
        }
      }

      // For Section E: FAMILY UNIT.
      if (sectionScores[5].sectionScore === 0) {
        if (/family unit/i.test(surveySections[i].content)) {
          sectionScores[5].sectionId = surveySections[i].apiSurveyServiceId;
          const qIds = _.pluck(SurveyQuestionsMaster.find(
            { $and: [
              { sectionID: surveySections[i]._id },
              { surveyID: surveyId },
            ] },
            { fields: { _id: 0, content: 1 } }
          ).fetch(), 'content');

          // FAMILY LEGAL ISSUES.
          const Q32 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /child protection/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ32;
          if (fromDb) {
            ansQ32 = spdatScoreHelpers.getAnswerFromDb(responseId, Q32._id, Q32.dataType);
          } else {
            ansQ32 = spdatScoreHelpers.getAnswer(Q32._id, Q32.dataType);   // lowercase 'y'
          }
          logger.log(`32. ${ansQ32} - ${typeof ansQ32}`);
          const Q33 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /impact your housing /i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ33;
          if (fromDb) {
            ansQ33 = spdatScoreHelpers.getAnswerFromDb(responseId, Q33._id, Q33.dataType);
          } else {
            ansQ33 = spdatScoreHelpers.getAnswer(Q33._id, Q33.dataType);   // lowercase 'y'
          }
          logger.log(`33. ${ansQ33} - ${typeof ansQ33}`);
          if (ansQ33 === 'y' || ansQ32 === 'y' || ansQ33 === 'yes' || ansQ32 === 'yes') {
            sectionScores[5].sectionScore += 1;
          }
          // NEEDS OF CHILDREN.
          const Q34 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /lived with family/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ34;
          if (fromDb) {
            ansQ34 = spdatScoreHelpers.getAnswerFromDb(responseId, Q34._id, Q34.dataType);
          } else {
            ansQ34 = spdatScoreHelpers.getAnswer(Q34._id, Q34.dataType);   // lowercase 'y'
          }
          logger.log(`34. ${ansQ34} - ${typeof ansQ34}`);
          const Q35 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /experienced abuse/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ35;
          if (fromDb) {
            ansQ35 = spdatScoreHelpers.getAnswerFromDb(responseId, Q35._id, Q35.dataType);
          } else {
            ansQ35 = spdatScoreHelpers.getAnswer(Q35._id, Q35.dataType);   // lowercase 'y'
          }
          logger.log(`35. ${ansQ35} - ${typeof ansQ35}`);
          if (ansQ34 === 'y' || ansQ35 === 'y' ||
            ansQ34 === 'yes' || ansQ35 === 'yes') {
            sectionScores[5].sectionScore += 1;
          } else if (schoolChild) {
            // Get ages of children and make this true if any school aged.
            const Q36 = Questions.findOne(
              { $and: [{ _id: { $in: qIds } }, { question: { $regex: /attend school/i } }] },
              { fields: { _id: 1, dataType: 1 } }
            );
            let ansQ36;
            if (fromDb) {
              ansQ36 = spdatScoreHelpers.getAnswerFromDb(responseId, Q36._id, Q36.dataType);
            } else {
              ansQ36 = spdatScoreHelpers.getAnswer(Q36._id, Q36.dataType);   // lowercase 'y'
            }
            logger.log(`36. ${ansQ36} - ${typeof ansQ36}`);
            if (ansQ36 === 'n' || ansQ36 === 'no') {
              sectionScores[5].sectionScore += 1;
            }
          }
          // FAMILY STABILITY.
          const Q37 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /family changed/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ37;
          if (fromDb) {
            ansQ37 = spdatScoreHelpers.getAnswerFromDb(responseId, Q37._id, Q37.dataType);
          } else {
            ansQ37 = spdatScoreHelpers.getAnswer(Q37._id, Q37.dataType);   // lowercase 'y'
          }
          logger.log(`${ansQ37} - ${typeof ansQ37}`);
          const Q38 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /coming to live/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ38;
          if (fromDb) {
            ansQ38 = spdatScoreHelpers.getAnswerFromDb(responseId, Q38._id, Q38.dataType);
          } else {
            ansQ38 = spdatScoreHelpers.getAnswer(Q38._id, Q38.dataType);   // lowercase 'y'
          }
          logger.log(`38. ${ansQ38} - ${typeof ansQ38}`);
          if (ansQ37 === 'y' || ansQ38 === 'y' || ansQ37 === 'yes' || ansQ38 === 'yes') {
            sectionScores[5].sectionScore += 1;
          }
          // PARENTAL MANAGEMENT.
          const Q39 = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /planned activities/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ39;
          if (fromDb) {
            ansQ39 = spdatScoreHelpers.getAnswerFromDb(responseId, Q39._id, Q39.dataType);
          } else {
            ansQ39 = spdatScoreHelpers.getAnswer(Q39._id, Q39.dataType);   // lowercase 'y'
          }
          logger.log(`39. ${ansQ39} - ${typeof ansQ39}`);
          const Q40a = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /3 or more/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ40a;
          if (fromDb) {
            ansQ40a = spdatScoreHelpers.getAnswerFromDb(responseId, Q40a._id, Q40a.dataType);
          } else {
            ansQ40a = spdatScoreHelpers.getAnswer(Q40a._id, Q40a.dataType);   // lowercase 'y'
          }
          logger.log(`40a. ${ansQ40a} - ${typeof ansQ40a}`);
          const Q40b = Questions.findOne(
            { $and: [{ _id: { $in: qIds } }, { question: { $regex: /2 or more/i } }] },
            { fields: { _id: 1, dataType: 1 } }
          );
          let ansQ40b;
          if (fromDb) {
            ansQ40b = spdatScoreHelpers.getAnswerFromDb(responseId, Q40b._id, Q40b.dataType);
          } else {
            ansQ40b = spdatScoreHelpers.getAnswer(Q40b._id, Q40b.dataType);   // lowercase 'y'
          }
          logger.log(`40b. ${ansQ40b} - ${typeof ansQ40b}`);
          if (ansQ39 === 'n' || ansQ40a === 'y' || ansQ40b === 'y' ||
            ansQ39 === 'no' || ansQ40a === 'yes' || ansQ40b === 'yes') {
            sectionScores[5].sectionScore += 1;
          } else if (flagForQ41) {
            const Q41 = Questions.findOne(
              { $and: [{ _id: { $in: qIds } }, { question: { $regex: /younger sibling/i } }] },
              { fields: { _id: 1, dataType: 1 } }
            );
            let ansQ41;
            if (fromDb) {
              ansQ41 = spdatScoreHelpers.getAnswerFromDb(responseId, Q41._id, Q41.dataType);
            } else {
              ansQ41 = spdatScoreHelpers.getAnswer(Q41._id, Q41.dataType);   // lowercase 'y'
            }
            logger.log(`41. ${ansQ41} - ${typeof ansQ41}`);
            if (ansQ41 === 'y' || ansQ41 === 'yes') {
              sectionScores[5].sectionScore += 1;
            }
          }
        }
      }
    }
    // Score section-wise. Now adding them and returning.
    logger.log(`${JSON.stringify(sectionScores)}`);
    return sectionScores;
  },
};
