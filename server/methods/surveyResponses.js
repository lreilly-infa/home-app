/**
 * Created by udit on 26/07/16.
 */

Meteor.methods(
  {
    addSurveyResponse(
      surveyID,
      clientID,
      isHMISClient,
      clientSchema,
      userID,
      mainSectionObject,
      status
    ) {
      const responsesCollection = HomeUtils.adminCollectionObject('responses');
      const responseRecords = responsesCollection.insert(
        {
          clientID,
          isHMISClient,
          clientSchema,
          surveyID,
          userID,
          responsestatus: status,
          section: mainSectionObject,
        }
      );
      return responseRecords;
    },
    updateSurveyResponse(
      responseID,
      surveyID,
      clientID,
      isHMISClient,
      clientSchema,
      userID,
      mainSectionObject,
      status
    ) {
      const responsesCollection = HomeUtils.adminCollectionObject('responses');
      const responseRecords = responsesCollection.update(
        {
          _id: responseID,
        }, {
          $set: {
            clientID,
            isHMISClient,
            clientSchema,
            surveyID,
            userID,
            responsestatus: status,
            section: mainSectionObject,
          },
        }
      );
      return responseRecords;
    },
    sendScoresToHMIS(surveyId, clientId, score) {
      // Send scores section-wise here.
      for (let i = 0; i < score.length; i += 1) {
        const sectionId = score[i].sectionId;
        const sectionScore = { sectionScore: score[i].sectionScore };
        const sectionScoresId =
          HMISAPI.createSectionScores(surveyId, clientId, sectionId, sectionScore);
        if (sectionScoresId) {
          // Add this ID to DB. For any reference.
          logger.log(`SurveyResponse.Js: ${sectionScoresId}`);
        }
      }
    },
    deleteOldScores(surveyId, clientId) {
      return HMISAPI.deleteSurveyScores(surveyId, clientId);
    },

    removeSurveyResponse(responseId) {
      check(responseId, String);
      const responsesCollection = HomeUtils.adminCollectionObject('responses');
      const response = responsesCollection.findOne(responseId);
      const canBeRemoved = true;
      if (!response) {
        throw new Meteor.Error(404, 'Response does not exists');
      }
      if (!canBeRemoved) {
        throw new Meteor.Error(403, 'You are not authorized to remove this response');
      }
      responsesCollection.remove(responseId);
    },
  }
);
