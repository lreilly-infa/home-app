import { HmisClient } from '/imports/api/hmisApi';
import Surveys from '/imports/api/surveys/surveys';
import Questions from '/imports/api/questions/questions';
import { PendingClients } from '/imports/api/pendingClients/pendingClients';
import { mapUploadedSurveySections } from '/imports/api/surveys/helpers';
import { computeFormState, findItem, getScoringVariables } from '/imports/api/surveys/computations';
import { logger } from '/imports/utils/logger';
import { escapeKeys, unescapeKeys } from '/imports/api/utils';
import Responses, { ResponseStatus } from '/imports/api/responses/responses';
import { prepareEmails } from '../surveys/computations';

function prepareValuesToUpload(values, definition, defaultSectionId) {
  const questionIds = Object.keys(values);
  logger.debug('prepareValuesToUpload', values);
  return questionIds.map(id => {
    const question = findItem(id, definition);
    return {
      id,
      questionId: question.hmisId,
      responseText: values[id],
      sectionId: defaultSectionId,
    };
  });
}

Meteor.methods({
  'responses.create'(doc) {
    logger.info(`METHOD[${Meteor.userId()}]: responses.create`, doc);
    check(doc, Object);
    const surveyorId = Meteor.users.findOne(Meteor.userId()).services.HMIS.accountId;
    const response = Object.assign({}, doc, {
      surveyorId,
      status: ResponseStatus.PAUSED,
      submissionId: null,
      values: escapeKeys(doc.values),
    });

    // TODO: check permissions
    check(response, Responses.schema);
    return Responses.insert(response);
  },

  'responses.update'(id, doc) {
    logger.info(`METHOD[${Meteor.userId()}]: responses.update`, id, doc);
    check(id, String);
    check(doc, Object);

    const oldResponse = Responses.findOne(id);

    const response = Object.assign({}, doc, {
      status: ResponseStatus.PAUSED,
      values: escapeKeys(doc.values),
      surveyorId: oldResponse.surveyorId,
    });
    check(response, Responses.schema);
    // TODO: check permissions
    return Responses.update(id, { $set: response });
  },

  'responses.delete'(id) {
    logger.info(`METHOD[${this.userId}]: responses.delete`, id);
    // TODO: check permissions
    check(id, String);

    try {
      const { clientId, surveyId, submissionId } = Responses.findOne(id);
      const hc = HmisClient.create(this.userId);
      hc.api('survey').deleteSubmission(clientId, surveyId, submissionId);
    } catch (err) {
      logger.warn('Failed to delete response', err);
    } finally {
      Responses.remove(id);
    }
  },

  'responses.sendEmails'(responseId) {
    logger.info(`METHOD[${Meteor.userId()}]: responses.emails`, responseId);
    // TODO: check permissions
    check(responseId, String);

    const response = Responses.findOne(responseId);
    const { clientId, clientSchema, surveyId } = response;
    const values = unescapeKeys(response.values);
    const survey = Surveys.findOne(surveyId);

    // FIXME: survey may not be in Mongo but in HSLYNK
    // TODO: fetch survey from HSLYNK as a fallback

    const definition = JSON.parse(survey.definition);

    const hc = HmisClient.create(Meteor.userId());

    const client = hc.api('client').getClient(clientId, clientSchema);
    const formState = computeFormState(definition, values, {}, { client });
    const emails = prepareEmails(definition, formState);

    logger.debug(`sending ${emails.length} emails`);
    emails.forEach(email => {
      try {
        const additionalInfo = {
          messageType: `Survey ${survey.title}`,
          recipientType: 'clientID',
          recipientId: clientId,
        };
        hc.api('global').sendEmailNotification(email, additionalInfo);
      } catch (e) {
        logger.error(e);
      }
    });
  },

  'responses.uploadToHmis'(id) {
    logger.info(`METHOD[${Meteor.userId()}]: responses.uploadToHmis`, id);
    check(id, String);

    // TODO: check permissions

    Responses.update(id, { $set: { status: ResponseStatus.UPLOADIND } });

    const response = Responses.findOne(id);
    const { clientId, surveyId } = response;
    const values = unescapeKeys(response.values);

    const hc = HmisClient.create(Meteor.userId());

    // check if survey exists in hslynk
    let survey;
    try {
      survey = hc.api('survey2').getSurvey(surveyId);
    } catch (err) {
      Responses.update(id, { $set: { status: ResponseStatus.UPLOAD_ERROR } });
      logger.error(err);
      throw new Meteor.Error('error', `Survey ${surveyId} not uploaded.`);
    }

    const definition = JSON.parse(survey.surveyDefinition);

    // collect scores to send from scoring variables
    const client = hc.api('client').getClient(response.clientId, response.clientSchema);
    const formState = computeFormState(definition, values, {}, { client });
    const scores = getScoringVariables(formState); // each score is { name, value } object
    logger.debug('scores to upload', scores);

    // get existing (in HMIS) sections for this survey
    // there are 2 types of sections:
    // one default section for storing all question values,
    // any number of score sections (for storing each value with name score.*)
    const existingSectionsData = hc.api('survey').getSurveySections(surveyId);
    const existingSections = mapUploadedSurveySections(existingSectionsData);
    logger.debug('existing sections', existingSections);

    // discover sectionId of default section (which will be used to upload question values)
    const defaultSectionId = existingSections.find(s => s.type === 'default').hmisId;
    // tie together question values, questions and default section,
    const allQuestionValues = prepareValuesToUpload(values, definition, defaultSectionId);
    // we are only interested in values for questions which have hmisIds
    const questionVaules = allQuestionValues.filter(v => v.questionId);

    let submissionId = response.submissionId;
    try {
      if (submissionId) {
        // if this response has already been submitted
        logger.info(`Updating existing submission, doc id ${id}`);
        const submissionResponses = hc.api('survey').getSubmissionResponses(
          clientId, surveyId, submissionId
        );
        const updatedResponses = submissionResponses.map(r => {
          const newValue = questionVaules.find(qv => r.questionId === qv.questionId);
          return {
            ...r,
            responseText: newValue.responseText,
          };
        });
        hc.api('survey').updateSubmissionResponses(
          clientId, surveyId, submissionId, updatedResponses
        );
        Responses.update(id, { $set: {
          status: ResponseStatus.COMPLETED,
        } });
      } else {
        logger.info(`Sending new submission, response doc ${id}`);
        // create new submission - send all question values in one call
        submissionId = hc.api('survey').createSubmission(
          clientId, surveyId, questionVaules
        ).submissionId;

        Responses.update(id, { $set: {
          submissionId,
          status: ResponseStatus.COMPLETED,
          submittedAt: new Date(),
        } });
      }
    } catch (e) {
      logger.error(`Response upload ${e}`, e.stack);
      Responses.update(id, { $set: { status: ResponseStatus.UPLOAD_ERROR } });
      throw new Meteor.Error('responses', `${e}`);
    }

    try {
      scores.forEach(score => {
        logger.info('Submitting score', score);
        const scoreSection = existingSections.filter(s => s.id === score.name)[0];
        if (!scoreSection) {
          throw new Meteor.Error('responses',
            `Score ${score.name} has no section in HMIS. Re-upload the survey`
          );
        }
        hc.api('survey').createSectionScores(clientId, surveyId, scoreSection.hmisId, {
          sectionScore: score.value,
        });
      });
    } catch (e) {
      logger.error(`Score upload ${e}`, e.stack);
      Responses.update(id, { $set: { status: ResponseStatus.UPLOAD_ERROR } });
      throw new Meteor.Error('responses', `Response submitted but failed to upload scores: ${e}`);
    }

    const invalidQuestionValues = allQuestionValues.filter(v => !v.questionId);
    return invalidQuestionValues;
  },

  'responses.uploadV1ToHmis'(id, defaultSectionId = '7db10270-ec7f-4b11-8d26-48e334c97b95') {
    logger.info(`METHOD[${this.userId}]: responses.uploadV1ToHmis`, id);

    function assertEqual(a, b, msg = '') {
      if (a !== b) throw new Error(`${a} !== ${b} ${msg}`);
    }

    const hc = HmisClient.create(this.userId);
    const response = Responses.findOne(id);

    assertEqual(response.version, 1, 'expected version === 1');
    assertEqual(response.status, 'Paused', 'expected Paused status');
    assertEqual(!!response.submissionId, false, 'Expected not submitted response');

    logger.debug('RESPONSE', response);

    const survey = Surveys.findOne(response.surveyId);

    logger.debug('SURVEY', survey);

    const questionResponses = response.section.reduce((all, s) => ([
      ...all,
      ...(s.response || []),
    ]), []);

    const questionValues = questionResponses
    .map((r) => {
      const question = Questions.findOne(r.questionID) || {};
      return {
        questionId: question.surveyServiceQuesId,
        responseText: r.answer,
        sectionId: defaultSectionId,
      };
    })
    .filter(x => x.questionId)
    .filter(x => x.responseText)
    .filter(x => !x.responseText.startsWith('This answer should be ignored'));

    const clientId = response.clientId;
    const surveyId = survey.apiSurveyServiceId;

    logger.debug({ clientId, surveyId, questionValues });

    const { submissionId } = hc.api('survey').createSubmission(
      clientId, surveyId, questionValues
    );
    Responses.update(id, {
      $set: {
        submissionId,
        status: ResponseStatus.COMPLETED,
        submittedAt: new Date(),
        version: 1,
      },
      $unset: {
        tmp: true,
      },
    }, { bypassCollection2: true });

    logger.info('DONE!', submissionId);
    return submissionId;
  },
  getResponsesPage(pageNumber = 0, pageSize = 50, sort = 'firstName', order = 'desc') {
    // TODO [VK]: if client id is set..
    logger.info(`METHOD[${Meteor.userId()}]: getResponsesPage(${pageNumber}, ${pageSize}, ${sort}, ${order})`); // eslint-disable-line max-len
    if (!Meteor.userId()) {
      throw new Meteor.Error(401, 'Unauthorized');
    }
    // const self = this;


    const hc = HmisClient.create(Meteor.userId());
    const clientsList = hc.api('client').getClients(); // .disableError(404);
    // TODO: replace with Cached value
    const clientsMap =
      clientsList.reduce((acc, client) => ({ ...acc, [client.clientId]: client }), {});
    // console.log('clientsMap', clientsMap);

    // const responsesPage =
    //   hc.api('house-matching-v2').getResponsesPage(pageNumber, pageSize, sort, order);

    // const clientsCache = {};
    const queue = [];

    const responses = Responses.find().fetch();
    const responsesOutput = [];
    // Publish the local data first, so the user can get a quick feedback.
    for (let i = 0, len = responses.length; i < len; i++) {
      const response = responses[i];
      const { clientId, clientSchema } = response;
      if (clientSchema) {
        response.clientDetails = { loading: true };
        queue.push({
          responseId: response._id,
          clientId,
          clientSchema,
        });
      } else {
        response.clientDetails = PendingClients.findOne({ _id: clientId })
        || { error: 'client not found (404)' };
      }
      if (clientsMap[clientId]) { response.clientDetails = clientsMap[clientId]; }
      // self.added('responses', response._id, response);
      responsesOutput.push(response);
    }
    // self.ready();


    return { content: responsesOutput, page: { totalPages: responsesOutput.length ? 1 : 0 } };

    // eachLimit(queue, Meteor.settings.connectionLimit, (data, callback) => {
    //   if (stopFunction) {
    //     callback();
    //     return;
    //   }
    //   Meteor.defer(() => {
    //     const apiEndpoint = hc.api('client'); // .disableError(404);
    //     const { responseId, clientId, clientSchema } = data;
    //     if (!clientsCache[clientId]) {
    //       try {
    //         clientsCache[clientId] = apiEndpoint.getClient(clientId, clientSchema);
    //         clientsCache[clientId].schema = clientSchema;
    //       } catch (e) {
    //         clientsCache[clientId] = { error: e.reason };
    //       }
    //     }
    //     self.changed('responses', responseId, { clientDetails: clientsCache[clientId] });
    //     callback();
    //   });
    // });
  },
});
