# Use one collection pipeline for manual and scheduled runs

Career Radar implements collection and ranking as one terminating worker invoked locally by a command and on GCP as a Cloud Run Job. The web service can start that Job on demand, while Cloud Scheduler starts the same Job periodically; both read the active Candidate Profile and Search Targets from Firestore and publish Collection Run progress and Job Recommendations back to Firestore, avoiding separate manual and scheduled implementations.
