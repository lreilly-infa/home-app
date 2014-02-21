package edu.weber.housing1000;

import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.DialogInterface;
import android.location.Location;
import android.os.Bundle;
import android.os.Parcel;
import android.support.v4.app.Fragment;
import android.support.v4.app.FragmentManager;
import android.support.v4.app.FragmentPagerAdapter;
import android.support.v4.view.ViewPager;
import android.support.v7.app.ActionBar;
import android.support.v7.app.ActionBarActivity;
import android.util.Log;
import android.view.MenuItem;
import android.view.View;
import android.widget.Toast;

import com.astuetz.PagerSlidingTabStrip;
import com.google.common.hash.HashCode;
import com.google.common.hash.HashFunction;
import com.google.common.hash.Hashing;

import java.io.File;

import edu.weber.housing1000.Data.SurveyListing;
import edu.weber.housing1000.Fragments.PhotosFragment;
import edu.weber.housing1000.Fragments.SignatureFragment;
import edu.weber.housing1000.Fragments.SurveyAppFragment;
import edu.weber.housing1000.Fragments.SurveyFragment;
import edu.weber.housing1000.Helpers.FileHelper;
import edu.weber.housing1000.Helpers.GPSTracker;
import edu.weber.housing1000.Helpers.REST.PostImage;
import edu.weber.housing1000.Helpers.REST.PostResponses;

public class SurveyFlowActivity extends ActionBarActivity implements PostResponses.OnPostSurveyResponsesTaskCompleted, PostImage.OnPostImageTaskCompleted {
    public static final String EXTRA_SURVEY = "survey";

    //These are used to keep track of the submission state
    boolean submittingSurvey;
    boolean isSurveySubmitted;
    boolean isSignatureSubmitted;
    boolean isPhotoSubmitted;

    boolean isSignatureCaptured;

    PagerSlidingTabStrip mTabs;                         //Tabs of the view
    SectionsPagerAdapter mSectionsPagerAdapter;         //Keeps track of the fragments
    ViewPager.OnPageChangeListener mPageChangeListener; //Listens for page changes
    CustomViewPager mViewPager;                         //View object that holds the fragments

    private SurveyListing surveyListing;
    private ProgressDialog progressDialog;
    private String folderHash;                          //The name of the survey folder (for files)
    private String clientSurveyId;                      //Client survey id for image submission
    private Location currentLocation;

    public ProgressDialog getProgressDialog() {
        return progressDialog;
    }

    public void setProgressDialog(ProgressDialog value) {
        progressDialog = value;
    }

    public String getFolderHash() {
        return folderHash;
    }

    public String getClientSurveyId() {
        return clientSurveyId;
    }

    public void setSubmittingSurvey(boolean value) {
        submittingSurvey = value;
    }

    public boolean getIsSignatureCaptured() {
        return isSignatureCaptured;
    }

    public void setIsSignatureCaptured(boolean value) {
        isSignatureCaptured = value;
        if (value && mTabs.getVisibility() != View.VISIBLE)
        {
            mTabs.setVisibility(View.VISIBLE);
            mViewPager.setCurrentItem(1);
        }
        else if (!value)
        {
            mTabs.setVisibility(View.GONE);
            mViewPager.setCurrentItem(0);
        }
    }

    public SurveyListing getSurveyListing() {
        return surveyListing;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_survey_flow);

        // Restore state after being recreated
        if (savedInstanceState != null) {
            surveyListing = (SurveyListing) savedInstanceState.getSerializable("surveyListing");
            folderHash = savedInstanceState.getString("folderHash");
            currentLocation = savedInstanceState.getParcelable("currentLocation");
        } else {
            // Grab the survey listing from the extras
            surveyListing = (SurveyListing) getIntent().getSerializableExtra(EXTRA_SURVEY);
            generateFolderHash();
        }

        // Create the adapter that will return a fragment for each of the three
        // primary sections of the activity.
        mSectionsPagerAdapter = new SectionsPagerAdapter(getSupportFragmentManager());

        // Set up the ViewPager with the sections adapter.
        mViewPager = (CustomViewPager) findViewById(R.id.pager);
        mViewPager.setAdapter(mSectionsPagerAdapter);

        mPageChangeListener = new ViewPager.OnPageChangeListener() {
            @Override
            public void onPageScrolled(int i, float v, int i2) {

            }

            @Override
            public void onPageSelected(int i) {
                final ActionBar actionBar = getSupportActionBar();

                String actionBarTitle = ((SurveyAppFragment) mSectionsPagerAdapter.getItem(i)).getActionBarTitle();

                actionBar.setTitle(actionBarTitle != null ? actionBarTitle : getResources().getString(R.string.app_name));
            }

            @Override
            public void onPageScrollStateChanged(int i) {

            }
        };
        // Set the page change listener
        mViewPager.setOnPageChangeListener(mPageChangeListener);

        // Bind the tabs to the ViewPager
        mTabs = (PagerSlidingTabStrip) findViewById(R.id.tabs);
        mTabs.setShouldExpand(true);
        mTabs.setViewPager(mViewPager);
        mTabs.setVisibility(View.GONE);

        // Set the page change listener for the tabs
        mTabs.setOnPageChangeListener(mPageChangeListener);

        // Force a page change update
        mViewPager.setCurrentItem(1);
        mViewPager.setCurrentItem(0);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);

        // Store the survey listing and folder hash
        outState.putSerializable("surveyListing", surveyListing);
        outState.putString("folderHash", folderHash);
        if (currentLocation != null)
            outState.putParcelable("currentLocation", currentLocation);
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // Handle action bar item clicks here. The action bar will
        // automatically handle clicks on the Home/Up button, so long
        // as you specify a parent activity in AndroidManifest.xml.
        int id = item.getItemId();
        if (id == R.id.action_settings) {
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    @Override
    public void onPostSurveyResponsesTaskCompleted(String result) {
        progressDialog.dismiss();

        isSurveySubmitted = true;

        Log.d("SURVEY RESPONSE", result);

        String[] split = result.split("=");
        clientSurveyId = split[split.length - 1];

        Log.d("clientSurveyId", clientSurveyId);

        mViewPager.setCurrentItem(0);

        SignatureFragment signatureFragment = (SignatureFragment) mSectionsPagerAdapter.getItem(0);
        signatureFragment.submitSignature();
    }

    @Override
    public void onPostImageTaskCompleted(String result) {
        progressDialog.dismiss();

        isSignatureSubmitted = true;

        Log.d("SIGNATURE RESPONSE", result);

        mViewPager.setCurrentItem(1);

        // Submit photos here
    }

    @Override
    public void onBackPressed() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setMessage("Cancel this survey?");
        builder.setPositiveButton("Yes", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                dialog.dismiss();

                // Delete the folder containing any related files
                File surveyDir = new File(FileHelper.getAbsoluteFilePath(getFolderHash(), ""));
                if (surveyDir.exists())
                {
                    Log.d("DELETING SURVEY DIR", surveyDir.getAbsolutePath());
                    FileHelper.deleteAllFiles(surveyDir);
                }

                finish();
            }
        });
        builder.setNegativeButton("No", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                dialog.dismiss();
            }
        }).show();
    }

    public void generateFolderHash() {
        HashFunction hf = Hashing.md5();
        HashCode hc = hf.newHasher().putLong(System.currentTimeMillis()).hash();

        folderHash = hc.toString();

        Log.d("FOLDER HASH", folderHash);
    }

    public Location getLocation() {
        if (currentLocation == null)
        {
            GPSTracker gps = new GPSTracker(this);

            if(gps.canGetLocation()) {
                gps.stopUsingGPS();
            } else {
                gps.showSettingsAlert();
            }

            return gps.getLocation();
        }

        return currentLocation;
    }

    /**
     * A {@link FragmentPagerAdapter} that returns a fragment corresponding to
     * one of the sections/tabs/pages.
     */
    public class SectionsPagerAdapter extends FragmentPagerAdapter {

        public SectionsPagerAdapter(FragmentManager fm) {
            super(fm);
        }

        @Override
        public Fragment getItem(int position) {
            // getItem is called to instantiate the fragment for the given page.
            switch (position) {
                case 0:
                    return new SignatureFragment("Signature", "Disclaimer");
                case 1:
                    return new PhotosFragment("Photos", "Client Photo(s)");
                case 2:
                    return new SurveyFragment("Survey", SurveyFlowActivity.this.surveyListing.getTitle());
                default:
                    return null;
            }
        }

        @Override
        public int getCount() {
            return 3;
        }

        @Override
        public CharSequence getPageTitle(int position) {
            switch (position) {
                case 0:
                    return "Signature";
                case 1:
                    return "Photos";
                case 2:
                    return "Survey";
                default:
                    return "";
            }
        }
    }

}
