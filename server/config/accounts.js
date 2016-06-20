/**
 * Created by udit on 12/12/15.
 */

// Set up login services
Meteor.startup(function() {
	// Add HMIS configuration entry
	ServiceConfiguration.configurations.remove({service:"google"});
	ServiceConfiguration.configurations.remove({service:"facebook"});
	ServiceConfiguration.configurations.update( {
		service: "HMIS",
	}, {
		$set: {
			hmisAPIEndpoints: AdminConfig.hmisAPIEndpoints,
			appId: "16631CFE-6909-4AC1-B4EB-57902AC7AF0A",
			appSecret: "appSecret"
		}
	}, {
		upsert: true
	} );
} );