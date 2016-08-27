/**
 * Created by udit on 08/04/16.
 */
const querystring = require('querystring');

HMISAPI = {
  currentUserId: '',
  setCurrentUserId(userId) {
    HMISAPI.currentUserId = userId;
  },
  getCurrentUserId() {
    return HMISAPI.currentUserId;
  },
  isJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  },
  renewAccessToken(refreshToken) {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    let responseContent = '';
    try {
      // Request an access token
      const urlPath = `${config.hmisAPIEndpoints.oauthBaseUrl}${config.hmisAPIEndpoints.token}`;
      const queryParams = {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        redirect_uri: OAuth._redirectUri('HMIS', config),
      };

      const url = `${urlPath}?${querystring.stringify(queryParams)}`;
      const authorization = new Buffer(`${config.appId}:${config.appSecret}` || '');

      responseContent = HTTP.post(url, {
        headers: {
          'X-HMIS-TrustedApp-Id': config.appId,
          Authorization: authorization.toString('base64'),
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }).content;
    } catch (err) {
      throw _.extend(
        new Error(`Failed to complete OAuth handshake with HMIS. ${err.message}`),
        { response: err.response }
      );
    }

    // If 'responseContent' parses as JSON, it is an error.
    // XXX which hmis error causes this behvaior?
    if (! HMISAPI.isJSON(responseContent)) {
      throw new Error(`Failed to complete OAuth handshake with HMIS. ${responseContent}`);
    }

    // Success!  Extract the hmis access token and expiration
    // time from the response
    const parsedResponse = JSON.parse(responseContent);
    const hmisAccessToken = parsedResponse.oAuthAuthorization.accessToken;
    const hmisExpires = parsedResponse.oAuthAuthorization.expiresIn;
    const hmisRefreshToken = parsedResponse.oAuthAuthorization.refreshToken;

    if (! hmisAccessToken) {
      throw new Error(
        /* eslint-disable */
        `Failed to complete OAuth handshake with hmis -- can\'t find access token in HTTP response. ${responseContent}`
        /* eslint-enable */
      );
    }
    return {
      accessToken: hmisAccessToken,
      expiresAt: hmisExpires,
      refreshToken: hmisRefreshToken,
    };
  },
  getUserAccessToken(userId) {
    const user = Meteor.users.findOne({ _id: userId });
    let accessToken = '';
    if (user && user.services && user.services.HMIS
        && user.services.HMIS.accessToken && user.services.HMIS.expiresAt) {
      const expiresAt = user.services.HMIS.expiresAt;
      const currentTimestamp = new Date().getTime();

      if (expiresAt > currentTimestamp) {
        accessToken = user.services.HMIS.accessToken;
      } else if (user.services.HMIS.refreshToken) {
        const newTokens = HMISAPI.renewAccessToken(user.services.HMIS.refreshToken);
        Meteor.users.update(
          {
            _id: user._id,
          },
          {
            $set: {
              'services.HMIS.accessToken': newTokens.accessToken,
              'services.HMIS.expiresAt': newTokens.expiresAt,
              'services.HMIS.refreshToken': newTokens.refreshToken,
            },
          }
        );
        accessToken = newTokens.accessToken;
      } else {
        throw _.extend(new Error('No valid refresh token for HMIS.'));
      }
    } else {
      throw _.extend(new Error('No valid access token for HMIS.'));
    }
    return accessToken;
  },
  getCurrentAccessToken(useCurrentUserObject = true) {
    let userId = HMISAPI.getCurrentUserId();
    if (useCurrentUserObject) {
      const user = Meteor.user();
      if (user && user._id) {
        userId = user._id;
      }
    }

    return HMISAPI.getUserAccessToken(userId);
  },
  createClient(client, schema = 'v2015') {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken();

    const body = {
      client: {
        firstName: client.firstName,
        middleName: client.middleName,
        lastName: client.lastName,
        nameSuffix: client.suffix,
        nameDataQuality: 1,
        ssn: client.ssn,
        ssnDataQuality: 1,
        dob: moment(client.dob).format('x'),
        dobDataQuality: 1,
        race: client.race,
        ethnicity: client.ethnicity,
        gender: client.gender,
        // Putting otherGender as null. Confirmed with Javier. Because it's of no use as of now.
        otherGender: 'null',
        veteranStatus: client.veteranStatus,
      },
    };

    try {
      const response = HTTP.post(
        config.hmisAPIEndpoints.clientBaseUrl
        + config.hmisAPIEndpoints[schema]
        + config.hmisAPIEndpoints.clients, {
          data: body,
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      ).data;

      return response.client.clientId;
    } catch (err) {
      // throw _.extend(new Error("Failed to search clients in HMIS. " + err.message),
      //                {response: err.response});
      logger.info(`Failed to create client in HMIS. ${err.message}`);
      logger.info(err.response);
      return false;
    }
  },
  getClient(clientId, schema = 'v2015') {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken();

    try {
      const response = HTTP.get(
        config.hmisAPIEndpoints.clientBaseUrl
        + config.hmisAPIEndpoints[schema]
        + config.hmisAPIEndpoints.clients + clientId, {
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      ).data;

      return response.client;
    } catch (err) {
      // throw _.extend(new Error("Failed to search clients in HMIS. " + err.message),
      //                {response: err.response});
      logger.info(`Failed to get client info from HMIS. ${err.message}`);
      logger.info(err.response);
      return false;
    }
  },
  getClientFromUrl(apiUrl) {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken();

    try {
      const response = HTTP.get(
        config.hmisAPIEndpoints.apiBaseUrl + apiUrl, {
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      ).data;

      return response.client;
    } catch (err) {
      // throw _.extend(new Error("Failed to search clients in HMIS. " + err.message),
      //                {response: err.response});
      logger.info(`Failed to get client info from HMIS with URL. ${err.message}`);
      logger.info(err.response);
      return false;
    }
  },
  searchClient(query, limit) {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken();

    const params = {
      q: query,
      maxItems: limit,
      sort: 'firstName',
      order: 'asc',
    };

    const baseUrl = config.hmisAPIEndpoints.clientBaseUrl;
    const searchClientPath = config.hmisAPIEndpoints.searchClient;
    const urlPath = `${baseUrl}${searchClientPath}`;
    const url = `${urlPath}?${querystring.stringify(params)}`;

    logger.info(url);

    try {
      const clients = [];
      const response = HTTP.get(url, {
        headers: {
          'X-HMIS-TrustedApp-Id': config.appId,
          Authorization: `HMISUserAuth session_token=${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }).data;

      const clientsReponse = response.searchResults.items;
      for (let i = 0; i < clientsReponse.length; i++) {
        logger.info(clientsReponse[i]);
        clients.push(clientsReponse[i]);
      }

      return clients;
    } catch (err) {
      // throw _.extend(new Error("Failed to search clients in HMIS. " + err.message),
      //                {response: err.response});
      logger.info(`Failed to search clients in HMIS. ${err.message}`);
      logger.info(err.response);
      return [];
    }
  },
  getEnrollments(clientId, schema = 'v2015') {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = this.getCurrentAccessToken();

    let enrollments = [];

    const baseUrl = config.hmisAPIEndpoints.clientBaseUrl;
    const schemaPath = config.hmisAPIEndpoints[schema];
    const enrollmentsPath = config.hmisAPIEndpoints.enrollments.replace('{{client_id}}', clientId);
    const urlPath = `${baseUrl}${schemaPath}${enrollmentsPath}`;
    // const url = `${urlPath}?${querystring.stringify(params)}`;
    const url = `${urlPath}`;

    logger.info(url);
    logger.info(accessToken);

    try {
      const response = HTTP.get(url, {
        headers: {
          'X-HMIS-TrustedApp-Id': config.appId,
          Authorization: `HMISUserAuth session_token=${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }).data;
      enrollments = response.enrollments.enrollments;
    } catch (err) {
      throw _.extend(
        new Error(`Failed to get housing units from HMIS. ${err.message}`),
        { response: err.response }
      );
    }

    return enrollments;
  },
  getEnrollmentExits(clientId, enrollmentId, schema = 2015) {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = this.getCurrentAccessToken();

    let exits = [];

    const baseUrl = config.hmisAPIEndpoints.clientBaseUrl;
    const schemaPath = config.hmisAPIEndpoints[schema];
    const enrollmentsPath = config.hmisAPIEndpoints.enrollmentExits.replace(
      '{{client_id}}',
      clientId
    );
    const exitsPath = enrollmentsPath.replace('{{enrollmentId}}', enrollmentId);
    const urlPath = `${baseUrl}${schemaPath}${exitsPath}`;
    // const url = `${urlPath}?${querystring.stringify(params)}`;
    const url = `${urlPath}`;

    logger.info(url);
    logger.info(accessToken);

    try {
      const response = HTTP.get(url, {
        headers: {
          'X-HMIS-TrustedApp-Id': config.appId,
          Authorization: `HMISUserAuth session_token=${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }).data;
      exits = response.exits.exits;
    } catch (err) {
      throw _.extend(
        new Error(`Failed to get housing units from HMIS. ${err.message}`),
        { response: err.response }
      );
    }

    return exits;
  },
  getHousingUnitsForPublish(/* page = 1, limit = 30 */) {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = this.getCurrentAccessToken(false);

    let housingUnits = [];

    const baseUrl = config.hmisAPIEndpoints.housingInventoryBaseUrl;
    const housingUnitsPath = config.hmisAPIEndpoints.housingUnits;
    const urlPath = `${baseUrl}${housingUnitsPath}`;
    // const url = `${urlPath}?${querystring.stringify(params)}`;
    const url = `${urlPath}`;

    logger.info(url);
    logger.info(accessToken);

    try {
      const response = HTTP.get(url, {
        headers: {
          'X-HMIS-TrustedApp-Id': config.appId,
          Authorization: `HMISUserAuth session_token=${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }).data;
      housingUnits = response;
    } catch (err) {
      throw _.extend(
        new Error(`Failed to get housing units from HMIS. ${err.message}`),
        { response: err.response }
      );
    }

    return housingUnits;
  },
  getHousingUnitForPublish(housingUnitId) {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = this.getCurrentAccessToken(false);

    let housingUnit = false;

    const baseUrl = config.hmisAPIEndpoints.housingInventoryBaseUrl;
    const housingUnitsPath = config.hmisAPIEndpoints.housingUnit.replace(
      '{{housing_unit_uuid}}',
      housingUnitId
    );
    const urlPath = `${baseUrl}${housingUnitsPath}`;
    // const url = `${urlPath}?${querystring.stringify(params)}`;
    const url = `${urlPath}`;

    logger.info(url);
    logger.info(accessToken);

    try {
      const response = HTTP.get(url, {
        headers: {
          'X-HMIS-TrustedApp-Id': config.appId,
          Authorization: `HMISUserAuth session_token=${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }).data;
      logger.info(response);
      housingUnit = response;
    } catch (err) {
      throw _.extend(
        new Error(`Failed to get housing units from HMIS. ${err.message}`),
        { response: err.response }
      );
    }

    return housingUnit;
  },
  createHousingUnit(housingUnitObject) {
    const body = [];
    // stringify to find out what is coming through.
    body.push(housingUnitObject);
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken();
    const baseUrl = config.hmisAPIEndpoints.housingInventoryBaseUrl;
    const housingUnitsPath = config.hmisAPIEndpoints.housingUnits;
    const urlPath = `${baseUrl}${housingUnitsPath}`;
    // const url = `${urlPath}?${querystring.stringify(params)}`;
    const url = `${urlPath}`;
    try {
      const response = HTTP.post(
        url, {
          data: body,
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          npmRequestOptions: {
            rejectUnauthorized: false, // TODO remove when deploy
          },
        }
      ).data;
      logger.log(response);
      return response[0];
    } catch (err) {
      logger.info(`Failed to get client info from HMIS. ${err.message}`);
      logger.info(err.response);
      return false;
    }
  },
  updateHousingUnit(housingUnitObject) {
    const body = [];
    // stringify to find out what is coming through.
    body.push(housingUnitObject);
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken();
    const baseUrl = config.hmisAPIEndpoints.housingInventoryBaseUrl;
    const housingUnitsPath = config.hmisAPIEndpoints.housingUnits;
    const urlPath = `${baseUrl}${housingUnitsPath}`;
    // const url = `${urlPath}?${querystring.stringify(params)}`;
    const url = `${urlPath}`;
    try {
      const response = HTTP.put(
        url, {
          data: body,
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          npmRequestOptions: {
            rejectUnauthorized: false, // TODO remove when deploy
          },
        }
      ).data;
      return response[0];
    } catch (err) {
      logger.info(`Failed to get client info from HMIS. ${err.message}`);
      logger.info(err.response);
      return false;
    }
  },
  deleteHousingUnit(housingInventoryId) {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken();
    const baseUrl = config.hmisAPIEndpoints.housingInventoryBaseUrl;
    const housingUnitsPath = config.hmisAPIEndpoints.housingUnit.replace(
      '{{housing_unit_uuid}}',
      housingInventoryId
    );
    const urlPath = `${baseUrl}${housingUnitsPath}`;
    const url = `${urlPath}`;
    try {
      const response = HTTP.del(
        url, {
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          npmRequestOptions: {
            rejectUnauthorized: false, // TODO remove when deploy
          },
        }
      ).data;
      logger.info(`Delete housing unit ${JSON.stringify(response)}`);
      return response;
    } catch (err) {
      // throw _.extend(new Error("Failed to search clients in HMIS. " + err.message),
      //                {response: err.response});
      logger.info(`Failed to get client info from HMIS. ${err.message}`);
      logger.info(err.response);
      return false;
    }
  },
  getGlobalHouseholdForPublish() {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = this.getCurrentAccessToken(false);

    let globalHousehold = [];

    const baseUrl = config.hmisAPIEndpoints.globalHouseholdBaseUrl;
    const globalHouseholdPath = config.hmisAPIEndpoints.globalHouseholds;
    const urlPath = `${baseUrl}${globalHouseholdPath}`;
    // const url = `${urlPath}?${querystring.stringify(params)}`;
    const url = `${urlPath}`;

    logger.info(url);
    logger.info(accessToken);

    try {
      const response = HTTP.get(url, {
        headers: {
          'X-HMIS-TrustedApp-Id': config.appId,
          Authorization: `HMISUserAuth session_token=${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }).data;
      logger.info(response);
      globalHousehold = response;
    } catch (err) {
      throw _.extend(
        new Error(`Failed to get global Household from HMIS. ${err.message}`),
        { response: err.response }
      );
    }

    return globalHousehold;
  },
  getSingleGlobalHouseholdForPublish(globalHouseholdId) {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = this.getCurrentAccessToken(false);

    let singleGlobalHousehold = false;

    const baseUrl = config.hmisAPIEndpoints.globalHouseholdBaseUrl;
    const singleGlobalHouseholdPath = config.hmisAPIEndpoints.globalHouseholdMembers.replace(
      '{{global_household_uuid}}',
      globalHouseholdId
    );
    const urlPath = `${baseUrl}${singleGlobalHouseholdPath}`;
    const url = `${urlPath}`;

    logger.info(url);
    logger.info(accessToken);

    try {
      const response = HTTP.get(url, {
        headers: {
          'X-HMIS-TrustedApp-Id': config.appId,
          Authorization: `HMISUserAuth session_token=${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }).data;
      logger.info(response);
      singleGlobalHousehold = response;
    } catch (err) {
      throw _.extend(
        new Error(`Failed to get single household details from HMIS. ${err.message}`),
        { response: err.response }
      );
    }

    return singleGlobalHousehold;
  },
  postQuestionAnswer(category, data) {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken();
    let response = '';

    try {
      response = HTTP.post(
        config.hmisAPIEndpoints.clientBaseUrl + config.hmisAPIEndpoints[category], {
          data,
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      ).data;
    } catch (err) {
      throw _.extend(
        new Error(`Failed to post answers to HMIS. ${err.message}`),
        { response: err.response }
      );
    }

    return response;
  },
  getClients() {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken();

    try {
      const response = HTTP.get(
        config.hmisAPIEndpoints.clientBaseUrl + config.hmisAPIEndpoints.clients, {
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          npmRequestOptions: {
            rejectUnauthorized: false, // TODO remove when deploy
          },
        }
      ).data;
      return response.Clients.clients;
    } catch (err) {
      // throw _.extend(new Error("Failed to search clients in HMIS. " + err.message),
      //                {response: err.response});
      logger.info(`Failed to get client info from HMIS. ${err.message}`);
      logger.info(err.response);
      return false;
    }
  },
  createGlobalHousehold(globalHouseholdMembers, globalHouseholdObject) {
    const body = [];
    body.push(globalHouseholdObject);
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken();

    try {
      const response = HTTP.post(
        config.hmisAPIEndpoints.globalHouseholdBaseUrl + config.hmisAPIEndpoints.globalHouseholds, {
          data: body,
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          npmRequestOptions: {
            rejectUnauthorized: false, // TODO remove when deploy
          },
        }
      ).data;
      HMISAPI.addMembersToHousehold(response[0].globalHouseholdId, globalHouseholdMembers);
      return response[0];
    } catch (err) {
      // throw _.extend(new Error("Failed to search clients in HMIS. " + err.message),
      //                {response: err.response});
      logger.info(`Failed to get client info from HMIS. ${err.message}`);
      logger.info(err.response);
      return false;
    }
  },
  addMembersToHousehold(globalHouseholdID, globalHouseholdMem) {
    const globalHouseholdMembers = globalHouseholdMem;
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken();
    const globalHouseholdMembersPath = config.hmisAPIEndpoints.globalHouseholdMembers.replace(
      '{{global_household_uuid}}',
       globalHouseholdID
    );
    try {
      const response = HTTP.post(
        config.hmisAPIEndpoints.globalHouseholdBaseUrl + globalHouseholdMembersPath, {
          data: globalHouseholdMembers,
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          npmRequestOptions: {
            rejectUnauthorized: false, // TODO remove when deploy
          },
        }
      ).data;
      return response;
    } catch (err) {
      // throw _.extend(new Error("Failed to search clients in HMIS. " + err.message),
      //                {response: err.response});
      logger.info(`Failed to get client info from HMIS. ${err.message}`);
      logger.info(err.response);
      return false;
    }
  },
  deleteGlobalHousehold(globalHouseholdID) {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken();
    const globalHouseholdMembersPath = config.hmisAPIEndpoints.globalHousehold.replace(
      '{{global_household_uuid}}',
       globalHouseholdID
    );
    try {
      const response = HTTP.del(
        config.hmisAPIEndpoints.globalHouseholdBaseUrl + globalHouseholdMembersPath, {
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          npmRequestOptions: {
            rejectUnauthorized: false, // TODO remove when deploy
          },
        }
      ).data;
      return response;
    } catch (err) {
      // throw _.extend(new Error("Failed to search clients in HMIS. " + err.message),
      //                {response: err.response});
      logger.info(`Failed to get client info from HMIS. ${err.message}`);
      logger.info(err.response);
      return false;
    }
  },
  getHousehold(globalHouseholdID) {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken();
    const globalHouseholdMembersPath = config.hmisAPIEndpoints.globalHousehold.replace(
      '{{global_household_uuid}}',
       globalHouseholdID
    );
    try {
      const response = HTTP.get(
        config.hmisAPIEndpoints.globalHouseholdBaseUrl + globalHouseholdMembersPath, {
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          npmRequestOptions: {
            rejectUnauthorized: false, // TODO remove when deploy
          },
        }
      ).data;
      return response;
    } catch (err) {
      // throw _.extend(new Error("Failed to search clients in HMIS. " + err.message),
      //                {response: err.response});
      logger.info(`Failed to get client info from HMIS. ${err.message}`);
      logger.info(err.response);
      return false;
    }
  },
  updateGlobalHousehold(globalHouseholdMembers, globalHouseholdObject) {
    const body = [];
    body.push(globalHouseholdObject);
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken();

    try {
      const response = HTTP.put(
        config.hmisAPIEndpoints.globalHouseholdBaseUrl + config.hmisAPIEndpoints.globalHouseholds, {
          data: body,
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          npmRequestOptions: {
            rejectUnauthorized: false, // TODO remove when deploy
          },
        }
      ).data;
      HMISAPI.updateMembersToHousehold(response[0].globalHouseholdId, globalHouseholdMembers);
      return response[0];
    } catch (err) {
      // throw _.extend(new Error("Failed to search clients in HMIS. " + err.message),
      //                {response: err.response});
      logger.info(`Failed to get client info from HMIS. ${err.message}`);
      logger.info(err.response);
      return false;
    }
  },
  updateMembersToHousehold(globalHouseholdID, globalHouseholdMem) {
    const globalHouseholdMembers = globalHouseholdMem;
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken();
    const globalHouseholdMembersPath = config.hmisAPIEndpoints.globalHouseholdMembers.replace(
      '{{global_household_uuid}}',
       globalHouseholdID
    );
    try {
      const response = HTTP.put(
        config.hmisAPIEndpoints.globalHouseholdBaseUrl + globalHouseholdMembersPath, {
          data: globalHouseholdMembers,
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          npmRequestOptions: {
            rejectUnauthorized: false, // TODO remove when deploy
          },
        }
      ).data;
      return response;
    } catch (err) {
      // throw _.extend(new Error("Failed to search clients in HMIS. " + err.message),
      //                {response: err.response});
      logger.info(`Failed to get client info from HMIS. ${err.message}`);
      logger.info(err.response);
      return false;
    }
  },
  getProjects(schema = 'v2015') {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken();

    try {
      const response = HTTP.get(
        config.hmisAPIEndpoints.clientBaseUrl
        + config.hmisAPIEndpoints[schema]
        + config.hmisAPIEndpoints.projects, {
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      ).data;
      return response;
    } catch (err) {
      // throw _.extend(new Error("Failed to search clients in HMIS. " + err.message),
      //                {response: err.response});
      logger.info(`Failed to get projects from HMIS. ${err.message}`);
      logger.info(err.response);
      return false;
    }
  },
  getProject(projectId, schema = 'v2015') {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken(false);

    try {
      const response = HTTP.get(
        config.hmisAPIEndpoints.clientBaseUrl
        + config.hmisAPIEndpoints[schema]
        + config.hmisAPIEndpoints.projects
        + projectId, {
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      ).data;

      return response.project;
    } catch (err) {
      // throw _.extend(new Error("Failed to search clients in HMIS. " + err.message),
      //                {response: err.response});
      logger.info(`Failed to get project info from HMIS. ${err.message}`);
      logger.info(err.response);
      return false;
    }
  },
  createProject(projectName, projectCommonName, schema = 'v2015') {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }

    const accessToken = HMISAPI.getCurrentAccessToken();

    const body = {
      project: {
        projectName,
        projectCommonName,
        continuumProject: 0,
        projectType: 14, // Coordinated Assessment
        residentialAffiliation: 0,
        targetPopulation: 4,  // NA - Not Applicable
        trackingMethod: 0,
      },
    };

    try {
      const response = HTTP.post(
        config.hmisAPIEndpoints.clientBaseUrl
        + config.hmisAPIEndpoints[schema]
        + config.hmisAPIEndpoints.projects, {
          data: body,
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      ).data;

      return response.project.projectId;
    } catch (err) {
      // throw _.extend(new Error("Failed to search clients in HMIS. " + err.message),
      //                {response: err.response});
      logger.info(`Failed to create project in HMIS. ${err.message}`);
      logger.info(err.response);
      return false;
    }
  },
  createSectionScores(surveyId, clientId, score) {
    const config = ServiceConfiguration.configurations.findOne({ service: 'HMIS' });
    if (! config) {
      throw new ServiceConfiguration.ConfigError();
    }
    const body = { score };
    const accessToken = HMISAPI.getCurrentAccessToken();
    let globalSectionScoresPath = config.hmisAPIEndpoints.sectionScores.replace(
      '{{client_id}}', clientId
    );
    globalSectionScoresPath = globalSectionScoresPath.replace('{{survey_id}}', surveyId);
    logger.info(`Section Scores HMIS: ${JSON.stringify(globalSectionScoresPath, null, 2)} `);
    logger.info(`Section Scores HMIS: ${JSON.stringify(body, null, 2)} `);
    // put a for loop and upload scores one by one. If all do not go at once.
    try {
      const response = HTTP.post(
        config.hmisAPIEndpoints.surveyServiceBaseUrl + globalSectionScoresPath, {
          data: body,
          headers: {
            'X-HMIS-TrustedApp-Id': config.appId,
            Authorization: `HMISUserAuth session_token=${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          npmRequestOptions: {
            rejectUnauthorized: false, // TODO remove when deploy
          },
        }
      ).data;
      return response;
    } catch (err) {
      logger.info(`Failed to save scores in HMIS. ${err.message}`);
      logger.info(err.response);
      return false;
    }
  },
};
