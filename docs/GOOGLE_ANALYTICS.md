# Google Analytics 4

The frontend uses GA4 Measurement ID `G-SRPBN79PVE` on `poscalfx.com` and
`www.poscalfx.com` in production builds. `VITE_GA_MEASUREMENT_ID` overrides this default.
Adding this code alone does not activate tracking or deploy it.

1. Create or select the Poscal GA4 property and its website data stream in Google Analytics.
2. In that stream, turn **Enhanced measurement off**. The app sends page views itself;
   automatic history tracking would duplicate them and could collect unsanitized URLs.
3. Deploy the frontend. The supplied Measurement ID is already configured for the live
   domains; no hosting environment variable is required.
4. Open the deployed site and navigate between pages. Check GA4 Realtime for page views
   and the browser Network panel for successful Google Analytics collection requests.
   Ad blockers may prevent collection.

Tracking is disabled in the Vite development server and on other hosts unless an override
is supplied. Leave the variable unset for preview deployments. To disable production
tracking, set `VITE_GA_MEASUREMENT_ID` to an empty string and rebuild/deploy.

Only page views are explicitly sent. Query strings, URL fragments, journal IDs and dates
are excluded; unknown routes are grouped under `/404`. No account IDs, email addresses,
trade values or note content are added. Google signals and ad personalization are disabled.
This integration does not include a consent manager; configure the site's consent handling
and privacy disclosure before activating collection where required.

Google's reference: https://developers.google.com/analytics/devguides/collection/ga4/views
