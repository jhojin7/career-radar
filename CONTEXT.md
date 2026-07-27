# Career Radar

Career Radar matches a person's professional background and job preferences against a pool of available job postings to produce evidence-based recommendations.

## Language

**Profile Draft**:
An unconfirmed profile assembled from career documents and stated preferences that may still contain extraction errors or omissions.
_Avoid_: Candidate Profile, extracted profile

**Candidate Profile**:
The user-confirmed representation of a person's experience, skills, career goals, location preferences, and deal-breakers used to assess job fit.
_Avoid_: User profile, resume

**Search Target**:
A user-confirmed role title, geographic scope, and work-mode preference used to discover candidate Job Postings for the Job Pool. It retrieves possibilities but does not determine fit.
_Avoid_: Search query, target role

**Job Posting**:
A single employment opportunity containing the role, employer, requirements, responsibilities, location, and employment conditions available for evaluation.
_Avoid_: Job, listing

**Job Pool**:
The collection of Job Postings currently available to Career Radar for comparison with a Candidate Profile.
_Avoid_: Agent's jobs, inventory

**Collection Run**:
One attempt to refresh the Job Pool and its Job Recommendations for the currently confirmed Candidate Profile and Search Targets, whether started manually or on a schedule.
_Avoid_: Batch, scrape job

**Fit Score**:
A reproducible measure of how well a Job Posting satisfies a Candidate Profile, subject to any disqualifying condition.
_Avoid_: AI score, recommendation score

**Fit Weights**:
The Candidate Profile's relative importance assigned to technical fit, experience fit, career direction, and work conditions when calculating a Fit Score. Fit Weights never override a Disqualifying Condition.
_Avoid_: Ranking preferences, scoring settings

**Disqualifying Condition**:
A Candidate Profile constraint that prevents a Job Posting from appearing in the ranked recommendation feed when the posting clearly violates it.
_Avoid_: Hard filter, rejection rule

**Review Required**:
The status of a Job Posting whose evidence is too ambiguous to confirm or dismiss a potential Disqualifying Condition.
_Avoid_: Maybe excluded, warning

**Job Recommendation**:
An evidence-backed assessment of a Job Posting's fit for a Candidate Profile, including its relative rank, strengths, gaps, and any Disqualifying Condition.
_Avoid_: Match, result
