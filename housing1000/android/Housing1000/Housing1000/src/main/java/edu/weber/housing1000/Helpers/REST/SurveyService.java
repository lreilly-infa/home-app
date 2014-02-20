package edu.weber.housing1000.Helpers.REST;

import java.util.List;

import edu.weber.housing1000.Data.Survey;
import edu.weber.housing1000.Data.SurveyListing;
import edu.weber.housing1000.Data.SurveyResponse;
import retrofit.client.Response;
import retrofit.http.Body;
import retrofit.http.GET;
import retrofit.http.Multipart;
import retrofit.http.POST;
import retrofit.http.Part;
import retrofit.http.Path;
import retrofit.mime.TypedFile;
import retrofit.mime.TypedString;

/**
 * This is used to perform our REST API calls
 * More info here: http://square.github.io/retrofit/
 */
public interface SurveyService {
    @GET("/survey")
    List<SurveyListing> listSurveys();
    @GET("/survey/{id}")
    Response getSurvey(@Path("id") String id);

    @POST("/survey/{id}")
    Response postResponse(@Path("id") String id, @Body SurveyResponse surveyResponse);

    @Multipart
    @POST("/upload")
    Response postImage(@Part("image") TypedFile image, @Part("description") TypedString description);
}
