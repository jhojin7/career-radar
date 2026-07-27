# Use Firestore and Cloud Storage for persistence

Career Radar stores structured profiles, Search Targets, Job Postings, collection runs, Fit Scores, and Job Recommendations in Firestore Native Mode, while source PDFs and raw posting snapshots live in Cloud Storage. This gives the Cloud Run service and scheduled job shared serverless persistence without a continuously running SQL instance; Firebase Hosting, Firebase Authentication, and Firebase client-side data access remain outside the architecture.
