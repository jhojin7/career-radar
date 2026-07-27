# Separate AI extraction from deterministic ranking

Career Radar uses Gemini to extract structured facts and evidence from career documents and Job Postings, while deterministic application rules calculate disqualifying conditions, Fit Scores, and ranking. Gemini may explain a Job Recommendation but does not choose its numeric score or rank; this preserves contextual understanding without making repeated evaluations unstable or opaque.
